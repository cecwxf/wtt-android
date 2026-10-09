import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createContext, runInContext, runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
function load(path, dependencies = {}) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, URL, AbortController, fetch, setTimeout, clearTimeout,
    require: name => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return module.exports;
}
const session = load('../lib/auth/native-web-session.ts');
const { NativeFilesBridge, NATIVE_FILES_MESSAGE } = load('../lib/files/native-files-protocol.ts', { '../auth/native-web-session': session });
const origin = 'https://www.ultraspace.ai';
const url = origin + '/mobile/workspaces';
const nonce = 'a'.repeat(64), requestId = 'b'.repeat(32);
const workspaceId = '11111111-1111-4111-8111-111111111111';
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(download = async () => {}) {
  let currentUrl = url;
  const requests = [], scripts = [], cancellations = [];
  const bridge = new NativeFilesBridge({ origin, currentUrl: () => currentUrl,
    inject: script => scripts.push(script), cancel: id => cancellations.push(id),
    download: async (...args) => { requests.push(args); return download(...args); },
  });
  const message = extra => JSON.stringify({ type: NATIVE_FILES_MESSAGE, action: 'download',
    nonce, requestId, workspaceId, path: 'README.md', filename: 'README.md', ...extra });
  return { bridge, message, requests, scripts, cancellations, navigate: value => { currentUrl = value; } };
}

test('actual injected browser bridge delivers Workspace and legacy Agent requests, progress and completion', async () => {
  for (const target of [{ workspaceId }, { agentId: 'agent-123456abcdef' }]) {
    const f = fixture(async (_request, current, progress) => {
      assert.equal(current(), true);
      progress({ loaded: 50, total: 100 });
      progress({ loaded: 100, total: 100 });
    });
    const window = { top: null, ReactNativeWebView: { postMessage: raw => f.bridge.handle(raw, url) } };
    window.top = window;
    const context = createContext({ window, location: { origin }, Map, Promise, setTimeout, clearTimeout, Error });
    f.scripts.push = script => runInContext(script, context);
    runInContext(f.bridge.openDocument(url, nonce), context);
    assert.equal(window.__WTT_NATIVE_FILES__.version, 2);
    const progress = [];
    await window.__WTT_NATIVE_FILES__.download({ requestId, ...target, path: 'README.md', filename: 'README.md' }, value => progress.push(value.loaded));
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0][0].workspaceId, target.workspaceId);
    assert.equal(f.requests[0][0].agentId, target.agentId);
    assert.deepEqual(progress, [0, 50, 100]);
    window.__WTT_NATIVE_FILES__.dispose();
  }
});

test('ambiguous targets, paths, foreign origins and stale nonces never invoke downloads', async () => {
  const f = fixture();
  f.bridge.openDocument(url, nonce);
  for (const extra of [{ agentId: 'agent-123456abcdef' }, { workspaceId: null },
    { workspaceId: 'bad' }, { workspaceId: undefined }, { path: '../private' },
    { path: '/private' }, { filename: '../private' }, { nonce: 'wrong' }]) {
    f.bridge.handle(f.message(extra), url);
  }
  f.bridge.handle(f.message({}), 'https://evil.test/mobile/workspaces');
  f.bridge.handle(f.message({}), origin + '/mobile/workspaces/preview');
  await tick();
  assert.equal(f.requests.length, 0);
});

test('one active transfer is retained, cancelled on invalidation and never completed in another document', async () => {
  let finish;
  const f = fixture(() => new Promise(resolve => { finish = resolve; }));
  f.bridge.openDocument(url, nonce);
  f.bridge.handle(f.message({}), url);
  f.bridge.handle(f.message({}), url);
  f.bridge.handle(f.message({ requestId: 'c'.repeat(32) }), url);
  assert.equal(f.requests.length, 1);
  assert.match(f.scripts[0], /busy/);
  f.navigate(origin + '/mobile/workspaces/hosts');
  f.bridge.invalidate();
  assert.equal(f.requests[0][1](), false);
  finish();
  await tick();
  assert.equal(f.scripts.length, 1);
  assert.ok(f.cancellations.length >= 2);
});
