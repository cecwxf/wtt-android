import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash, webcrypto } from 'node:crypto';
import { runInNewContext, createContext, runInContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const module = { exports: {} };
runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/auth/native-web-session.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module, exports: module.exports, URL, AbortController, setTimeout, clearTimeout, fetch });
const { NativeWebSession, nativeWebSessionScript, isTrustedAppUrl, NATIVE_SESSION_MESSAGE } = module.exports;
const origin = 'https://www.ultraspace.ai';
const url = `${origin}/mobile/feed?source=android&topic_id=test-topic`;
const nonce = 'a'.repeat(64);
const requestId = 'b'.repeat(32);
const grantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const grant = { ticket: 't'.repeat(43), session_id: grantId, expires_in: 90 };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); }
  assert.fail('Expected asynchronous bridge result');
}

function fixture(fetcher = async () => Response.json(grant)) {
  const calls = [], scripts = [], errors = [];
  let credentials = { token: 'native-secret-do-not-inject', userId: 'alice' }, currentUrl = url;
  const controller = new NativeWebSession({ origin, apiUrl: 'https://api.example.test',
    credentials: () => credentials, currentUrl: () => currentUrl,
    inject: script => scripts.push(script), reportError: error => errors.push(error),
    signOut: async () => { credentials = null; controller.credentialsChanged(); },
    fetch: async (...args) => { calls.push(args); return fetcher(...args); },
  });
  const message = (action = 'grant', extra = {}) => JSON.stringify({ type: NATIVE_SESSION_MESSAGE, action,
    nonce, requestId, challenge: 'c'.repeat(43), ...extra });
  return { controller, message, calls, scripts, errors,
    setCredentials: value => { credentials = value; controller.credentialsChanged(); },
    navigate: value => { currentUrl = value; controller.invalidate(); },
  };
}

test('native bridge accepts exact HTTPS app origins and excludes media, preview, credentials and lookalikes', () => {
  assert.equal(isTrustedAppUrl(url, origin), true);
  for (const raw of ['http://www.ultraspace.ai/mobile/feed', `${origin}:444/mobile/feed`,
    'https://www.ultraspace.ai.evil.test/mobile/feed', 'https://u:p@www.ultraspace.ai/mobile/feed',
    `${origin}/api/wtt/media/test.html`, `${origin}/preview`, 'data:text/html,hello', 'bad']) {
    assert.equal(isTrustedAppUrl(raw, origin), false, raw);
  }
});

test('forged, oversized, previous-document and cross-origin requests never issue native grants', () => {
  const f = fixture();
  f.controller.openDocument(url, nonce);
  for (const raw of [f.message('grant', { nonce: 'wrong' }), f.message('grant', { challenge: 'x'.repeat(10000) }),
    f.message('grant', { requestId: 'bad' }), 'null']) f.controller.handle(raw, url);
  f.controller.handle(f.message(), `${origin}/api/wtt/media/attachment.html`);
  f.controller.handle(f.message(), 'https://evil.test/mobile/feed');
  f.navigate(`${origin}/mobile/settings`);
  f.controller.handle(f.message(), url);
  assert.equal(f.calls.length, 0);
});

test('duplicate grant requests merge; only a short ticket enters the generated response', async () => {
  let finish;
  const f = fixture(endpoint => endpoint.endsWith('/tickets') ? new Promise(resolve => { finish = resolve; }) : Response.json({ ok: true }));
  const script = f.controller.openDocument(url, nonce);
  assert.doesNotMatch(script, /native-secret-do-not-inject/);
  f.controller.handle(f.message(), url);
  f.controller.handle(f.message(), url);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][1].headers.Authorization, 'Bearer native-secret-do-not-inject');
  assert.deepEqual(JSON.parse(f.calls[0][1].body), { code_challenge: 'c'.repeat(43), web_origin: origin });
  finish(Response.json(grant));
  await until(() => f.scripts.length === 1);
  assert.match(f.scripts[0], /tttttt/);
  assert.doesNotMatch(f.scripts[0], /native-secret|Authorization/);
  f.controller.invalidate();
});

test('a late grant after navigation or account change is revoked, never injected', async () => {
  for (const change of ['navigation', 'account']) {
    let finish;
    const f = fixture((endpoint) => endpoint.endsWith('/tickets') ? new Promise(resolve => { finish = resolve; }) : Response.json({ ok: true }));
    f.controller.openDocument(url, nonce);
    f.controller.handle(f.message(), url);
    if (change === 'navigation') f.navigate('https://evil.test');
    else f.setCredentials({ token: 'bob-native-secret', userId: 'bob' });
    finish(Response.json(grant));
    await until(() => f.calls.length === 2);
    assert.equal(f.scripts.length, 0);
    assert.equal(f.calls[1][0], `https://api.example.test/auth/mobile-web/sessions/${grantId}/revoke`);
    assert.equal(f.calls[1][1].headers.Authorization, 'Bearer native-secret-do-not-inject');
  }
});

test('owner-mismatched exchange is revoked; successful exchange is acknowledged before reload and reused', async () => {
  for (const userId of ['bob', 'alice']) {
    const f = fixture();
    f.controller.openDocument(url, nonce);
    f.controller.handle(f.message(), url);
    await until(() => f.scripts.length === 1);
    f.controller.handle(f.message('result', { ok: true, userId }), url);
    const next = f.controller.openDocument(url, 'c'.repeat(64));
    if (userId === 'alice') {
      assert.match(next, new RegExp(grantId));
      assert.match(f.scripts[1], /"ok":true/);
      assert.equal(f.calls.length, 1);
    } else {
      assert.doesNotMatch(next, new RegExp(grantId));
      assert.equal(f.calls.length, 2);
      assert.equal(f.errors.length, 1);
    }
    f.controller.invalidate();
  }
});

test('native logout acknowledgment survives clearing native credentials', async () => {
  const f = fixture();
  f.controller.openDocument(url, nonce);
  f.controller.handle(f.message('sign-out'), url);
  await until(() => f.scripts.length === 1);
  assert.match(f.scripts[0], /"ok":true/);
  assert.equal(f.calls.length, 0);
  f.controller.invalidate();
});

test('real injected page script performs S256, cookie exchange and native acknowledgment without exposing owner token', async () => {
  let context, browserSession = {}, exchanged = false, acknowledged = false;
  const messages = [], requests = [], storage = new Map([['__WTT_NATIVE_ACCESS_TOKEN__', 'old-native-secret']]);
  let challenge;
  const f = fixture(async (endpoint, options) => {
    if (endpoint.endsWith('/tickets')) challenge = JSON.parse(options.body).code_challenge;
    return Response.json(grant);
  });
  const events = new EventTarget(), docEvents = new EventTarget();
  const window = { top: null, location: { origin, pathname: '/mobile/feed', search: '?source=android', href: url,
    replace: () => { assert.equal(acknowledged, true); exchanged = true; } },
    ReactNativeWebView: { postMessage: raw => { messages.push(raw); f.controller.handle(raw, url); } },
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  };
  window.top = window;
  context = createContext({ window, location: window.location, document: { visibilityState: 'visible',
    addEventListener: docEvents.addEventListener.bind(docEvents), removeEventListener: docEvents.removeEventListener.bind(docEvents) },
    crypto: webcrypto, TextEncoder, URL, URLSearchParams, Uint8Array, Map, Date, Event, btoa, AbortController, setTimeout, clearTimeout,
    localStorage: { removeItem: key => storage.delete(key) },
    fetch: async (endpoint, options) => {
      requests.push([endpoint, options]);
      if (endpoint === '/api/auth/session') return Response.json(browserSession);
      if (endpoint === '/api/wtt/auth/me') return Response.json({ user_id: 'alice' });
      assert.equal(endpoint, '/api/mobile/native-session');
      const payload = JSON.parse(options.body);
      assert.equal(payload.ticket, grant.ticket);
      assert.equal(createHash('sha256').update(payload.code_verifier).digest('base64url'), challenge);
      assert.equal(options.headers.Authorization, undefined);
      browserSession = { userId: 'alice', mobileWebSessionId: grantId, accessToken: 'child-only', accessTokenExpiresAt: Date.now() + 100000 };
      return Response.json({ ok: true, userId: 'alice' });
    },
  });
  // Execute every native response in the actual page context, including the final acknowledgment.
  f.scripts.push = script => {
    if (script.includes('"ok":true') && !script.includes('"ticket"')) acknowledged = true;
    runInContext(script, context);
  };
  runInContext(f.controller.openDocument(url, nonce), context);
  await until(() => exchanged);
  assert.equal(storage.has('__WTT_NATIVE_ACCESS_TOKEN__'), false);
  assert.equal(messages.length, 2);
  assert.doesNotMatch(messages.join(''), /native-secret|old-native-secret|code_verifier/);
  window.__WTT_NATIVE_SESSION__.dispose();
  requests.length = 0;
  runInContext(f.controller.openDocument(url, 'd'.repeat(64)), context);
  await until(() => requests.some(([endpoint]) => endpoint === '/api/wtt/auth/me'));
  await tick();
  assert.equal(f.calls.length, 1, 'navigation must reuse the valid child instead of leaking grants');
  window.__WTT_NATIVE_SESSION__.dispose();
  f.controller.invalidate();
});

test('injected protocol does not execute in an iframe or arbitrary same-origin preview', () => {
  for (const location of [{ origin, pathname: '/preview' }, { origin: 'https://evil.test', pathname: '/mobile/feed' }]) {
    runInNewContext(nativeWebSessionScript({ origin, nonce, userId: 'alice', sessionId: '' }), { window: { top: {} }, location });
  }
  const window = {}; window.top = window;
  runInNewContext(nativeWebSessionScript({ origin, nonce, userId: 'alice', sessionId: '' }), { window, location: { origin, pathname: '/preview' } });
  assert.equal(window.__WTT_NATIVE_SESSION__, undefined);
});
