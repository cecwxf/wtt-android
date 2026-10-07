import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function fixture({ fetcher, login, storageSet } = {}) {
  const storage = new Map(), requests = [], module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('../stores/auth.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, AbortController, setTimeout, clearTimeout,
    fetch: async (...args) => { requests.push(args); return fetcher ? fetcher(...args) : Response.json({ user_id: 'alice', display_name: 'Alice' }); },
    require(name) {
      if (name === 'zustand') return require(name);
      if (name === '@/lib/api/base-url') return { WTT_API_URL: 'https://api.example.test' };
      if (name === '@/lib/api/wtt-client') return { WTTApiClient: class {
        loginWithPhonePassword = login || (async () => ({ access_token: 'alice-token' }));
      } };
      if (name === '@/lib/storage/secure-store') return {
        getSecureItem: async key => storage.get(key) || null,
        setSecureItem: async (key, value) => { if (storageSet) await storageSet(key, value); storage.set(key, value); },
        deleteSecureItem: async key => storage.delete(key),
      };
      throw new Error(`Unexpected module ${name}`);
    },
  });
  return { store: module.exports.useAuthStore, storage, requests };
}

test('native credentials are paired only with independently verified account identity', async () => {
  const f = fixture();
  await f.store.getState().setToken('alice-token', { id: 'forged-bob' });
  assert.equal(f.store.getState().user.id, 'alice');
  assert.equal(JSON.parse(f.storage.get('wtt_auth_session_v1')).user.id, 'alice');
  assert.equal(f.requests[0][1].headers.Authorization, 'Bearer alice-token');
});

test('invalid identity cannot install a new token with the previously cached account', async () => {
  const f = fixture({ fetcher: async (_url, options) => options.headers.Authorization.endsWith('alice-token')
    ? Response.json({ user_id: 'alice' }) : Response.json({}, { status: 401 }) });
  await f.store.getState().setToken('alice-token');
  await assert.rejects(f.store.getState().setToken('bob-invalid-token'), /verify your WTT account/);
  assert.equal(f.store.getState().token, 'alice-token');
  assert.equal(JSON.parse(f.storage.get('wtt_auth_session_v1')).token, 'alice-token');
});

test('logout revokes only its captured parent, clears storage and ignores a late login response', async () => {
  let complete;
  const f = fixture({ login: () => new Promise(resolve => { complete = resolve; }) });
  await f.store.getState().setToken('alice-token');
  const login = f.store.getState().login('phone', 'password');
  await f.store.getState().logout();
  complete({ access_token: 'late-native-token' });
  await assert.rejects(login, /superseded/);
  assert.equal(f.store.getState().isAuthenticated, false);
  assert.equal(JSON.parse(f.storage.get('wtt_auth_session_v1')).token, null);
  const revoke = f.requests.find(([url]) => url.endsWith('/revoke-parent'));
  assert.equal(revoke[1].headers.Authorization, 'Bearer alice-token');
});

test('account change during secure storage write leaves only the latest verified identity', async () => {
  let release, started;
  const writing = new Promise(resolve => { started = resolve; });
  const f = fixture({ fetcher: async (_url, options) => Response.json({ user_id: options.headers.Authorization.includes('bob') ? 'bob' : 'alice' }),
    storageSet: async (key, value) => {
      if (key === 'wtt_auth_session_v1' && JSON.parse(value).token === 'alice-token') {
        started(); await new Promise(resolve => { release = resolve; });
      }
    } });
  const alice = f.store.getState().setToken('alice-token');
  const rejected = assert.rejects(alice, /superseded/);
  await writing;
  const bob = f.store.getState().setToken('bob-token');
  release();
  await rejected;
  await bob;
  assert.equal(JSON.parse(f.storage.get('wtt_auth_session_v1')).token, 'bob-token');
  assert.equal(JSON.parse(f.storage.get('wtt_auth_session_v1')).user.id, 'bob');
  assert.equal(f.store.getState().user.id, 'bob');
});

test('offline logout still clears native session and does not retain a token for automatic relogin', async () => {
  const f = fixture({ fetcher: async (url) => {
    if (url.endsWith('/revoke-parent')) throw new Error('offline');
    return Response.json({ user_id: 'alice' });
  } });
  await f.store.getState().setToken('alice-token');
  await f.store.getState().logout();
  assert.equal(JSON.parse(f.storage.get('wtt_auth_session_v1')).token, null);
  assert.equal(f.store.getState().token, null);
});

test('legacy split-key migration verifies the token owner and persists one atomic session', async () => {
  const f = fixture();
  f.storage.set('wtt_auth_token', 'alice-token');
  f.storage.set('wtt_user', JSON.stringify({ id: 'stale-bob' }));
  await f.store.getState().loadToken();
  assert.equal(f.store.getState().user.id, 'alice');
  assert.equal(JSON.parse(f.storage.get('wtt_auth_session_v1')).user.id, 'alice');
  assert.equal(f.storage.has('wtt_auth_token'), false);
});

test('logout tombstone takes precedence over leftover legacy tokens after a crash', async () => {
  const f = fixture();
  f.storage.set('wtt_auth_session_v1', JSON.stringify({ version: 1, token: null, user: null }));
  f.storage.set('wtt_auth_token', 'alice-token');
  await f.store.getState().loadToken();
  assert.equal(f.store.getState().isAuthenticated, false);
  assert.equal(f.requests.length, 0);
});
