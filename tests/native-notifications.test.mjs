import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(relative, dependencies = {}) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, URL, AbortController, fetch, setTimeout, clearTimeout,
    require: name => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return module.exports;
}
const session = load('../lib/auth/native-web-session.ts');
const { NativeNotificationsBridge, NOTIFICATION_MESSAGE } = load('../lib/notifications/protocol.ts', {
  '../auth/native-web-session': session,
});
const origin = 'https://www.ultraspace.ai', url = `${origin}/mobile/feed`, nonce = 'a'.repeat(64);
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let userId = 'alice', currentUrl = url;
  const scripts = [], calls = [];
  const dependencies = { origin, currentUrl: () => currentUrl, userId: () => userId, inject: value => scripts.push(value),
    preferences: async () => ({ enabled: false, sound: false, preview: false, granted: false }),
    setPreferences: async (_user, value) => { calls.push('save'); return { ...value, granted: true }; },
    show: async (_value, current) => { assert.ok(current()); calls.push('show'); return true; } };
  const bridge = new NativeNotificationsBridge(dependencies);
  bridge.openDocument(url, nonce);
  const message = (action = 'show', extra = {}) => JSON.stringify({
    type: NOTIFICATION_MESSAGE, nonce, requestId: 'b'.repeat(32), action, userId: 'alice',
    value: { userId: 'alice', messageId: 'message-a', agentId: 'agent-a', topicId: 'topic-a', title: 'WTT', body: 'Test reply', focused: false },
    ...extra,
  });
  return { bridge, message, dependencies, calls, scripts, user: value => { userId = value; }, navigate: value => { currentUrl = value; } };
}

test('notification bridge rejects cross-origin, forged account, stale nonce and oversized requests', async () => {
  const f = fixture();
  f.bridge.handle(f.message(), 'https://evil.test/mobile/feed');
  f.bridge.handle(f.message('show', { userId: 'bob' }), url);
  f.bridge.handle(f.message('show', { nonce: 'bad' }), url);
  f.bridge.handle(f.message('show', { value: { body: 'x'.repeat(10000) } }), url);
  await tick();
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.scripts, []);
});

test('duplicate in-flight notices invoke native delivery once', async () => {
  const f = fixture();
  f.bridge.handle(f.message(), url);
  f.bridge.handle(f.message(), url);
  await tick();
  assert.deepEqual(f.calls, ['show']);
  assert.equal(f.scripts.length, 1);
  assert.match(f.scripts[0], /"shown":true/);
});

test('account and document changes suppress late completion and stale work', async () => {
  const f = fixture();
  let finish;
  f.dependencies.show = async () => new Promise(resolve => { finish = resolve; });
  f.bridge.handle(f.message(), url);
  await tick();
  f.user('bob');
  finish(true);
  await tick();
  assert.deepEqual(f.scripts, []);
  f.bridge.handle(f.message('preferences', { userId: 'bob' }), url);
  f.navigate(`${origin}/preview`);
  await tick();
  assert.deepEqual(f.scripts, []);
});

test('permission-setting admission is serialized and generated scripts carry no account credentials', async () => {
  const f = fixture();
  let finish;
  f.dependencies.setPreferences = async () => new Promise(resolve => { finish = resolve; });
  const value = { enabled: true, sound: false, preview: false };
  f.bridge.handle(f.message('setPreferences', { value }), url);
  f.bridge.handle(f.message('setPreferences', { requestId: 'c'.repeat(32), value }), url);
  await tick();
  assert.equal(typeof finish, 'function');
  assert.equal(f.scripts.length, 1);
  assert.match(f.scripts[0], /"ok":false/);
  f.bridge.invalidate();
  finish({ ...value, granted: true });
  await tick();
  assert.equal(f.scripts.length, 1);
  const script = f.bridge.openDocument(url, nonce);
  assert.doesNotMatch(script, /accessToken|refreshToken|Bearer/);
});
