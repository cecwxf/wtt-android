import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function fixture(enabled = true, acquireToken) {
  const module = { exports: {} };
  const files = new Map();
  const requests = [];
  let state = { user: { id: 'alice' }, token: 'synthetic-alice-token' };
  let tokenCalls = 0;
  const projectId = 'c4788ed5-306f-4662-ab7a-4392fd044a31';
  const code = ts.transpileModule(readFileSync(new URL('../lib/notifications/native-push.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, console, setTimeout, clearTimeout, AbortController,
    fetch: async (url, options) => {
      requests.push({ url, owner: options.headers.Authorization, body: options.body ? JSON.parse(options.body) : undefined });
      return { ok: true, status: 200, text: async () => JSON.stringify(url.endsWith('capabilities') ? { enabled, project_id: projectId } : { ok: true }) };
    }, require: name => {
      if (name === 'expo-constants') return { default: { easConfig: { projectId } } };
      if (name === 'expo-crypto') return { randomUUID: () => 'c4788ed5-306f-4662-ab7a-4392fd044a32', getRandomBytesAsync: async () => new Uint8Array(32).fill(4) };
      if (name === 'expo-file-system') return { documentDirectory: 'file:///fixture/', getInfoAsync: async key => ({ exists: files.has(key), size: files.get(key)?.length || 0 }),
        readAsStringAsync: async key => files.get(key), writeAsStringAsync: async (key, value) => { files.set(key, value); } };
      if (name === 'expo-notifications') return { getPermissionsAsync: async () => ({ granted: true }),
        getExpoPushTokenAsync: async () => { tokenCalls++; return acquireToken ? acquireToken() : { type: 'expo', data: 'ExpoPushToken[synthetic-valid-token-0123456789]' }; } };
      if (name === 'react-native') return { AppState: { currentState: 'active' }, Platform: { OS: 'android' } };
      if (name === '@/stores/auth') return { useAuthStore: { getState: () => state } };
      if (name === '@/lib/api/base-url') return { WTT_API_URL: 'https://api.example.test' };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { api: module.exports, requests, files, tokenCalls: () => tokenCalls, switchAccount: () => { state = { user: { id: 'bob' }, token: 'synthetic-bob-token' }; } };
}

test('unconfigured service never registers with Expo or stores an installation secret', async () => {
  const f = fixture(false);
  assert.equal(await f.api.syncPush({ enabled: true, sound: false }), 'not_configured');
  assert.equal(f.tokenCalls(), 0);
  assert.equal(f.files.size, 0);
  assert.equal(f.requests.length, 1);
});

test('registration uses the native account and disabling revokes the same private installation', async () => {
  const f = fixture();
  assert.equal(await f.api.syncPush({ enabled: true, sound: false }), 'registered');
  const request = f.requests.find(value => value.url.endsWith('/devices'));
  assert.ok(request);
  assert.equal(request.owner, 'Bearer synthetic-alice-token');
  assert.equal(request.body.userId, undefined);
  assert.match(request.body.device_secret, /^[a-f0-9]{64}$/);
  assert.equal(request.body.project_id, 'c4788ed5-306f-4662-ab7a-4392fd044a31');
  assert.equal(await f.api.syncPush({ enabled: false, sound: false }, true), 'off');
  const revoke = f.requests.at(-1);
  assert.ok(revoke.url.endsWith('/devices/revoke'));
  assert.equal(revoke.body.device_id, request.body.device_id);
});

test('a delayed Expo token cannot register after the native account changes', async () => {
  let complete;
  const f = fixture(true, () => new Promise(resolve => { complete = resolve; }));
  const pending = f.api.syncPush({ enabled: true, sound: false });
  for (let i = 0; i < 20 && !complete; i++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(complete);
  f.switchAccount();
  complete({ type: 'expo', data: 'ExpoPushToken[synthetic-valid-token-0123456789]' });
  assert.equal(await pending, 'off');
  assert.equal(f.requests.some(value => value.url.endsWith('/devices')), false);
  assert.equal(f.files.size, 0);
});
