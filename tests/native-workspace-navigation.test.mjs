import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const ts = createRequire(import.meta.url)('typescript');
const source = ts.createSourceFile('webview.tsx', readFileSync(new URL('../app/webview.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(['appendMobileParams', 'routeParam', 'mapNativePathToWebUrl', 'mapDeepLinkToWebUrl']);
const declarations = source.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
assert.equal(declarations.length, names.size);
const context = { URL, Platform: { OS: 'ios' } };
runInNewContext(ts.transpileModule(declarations.map(node => node.getText(source)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { mapNativePathToWebUrl: native, mapDeepLinkToWebUrl: deep } = context;
const base = 'https://www.ultraspace.ai';

test('notification destinations retain Topic selection on the Workspace route', () => {
  const url = new URL(native('/workspaces', { agentId: 'agent-one', topic: 'topic-one', token: 'never-forward' }, base));
  assert.equal(url.pathname, '/mobile/workspaces');
  assert.equal(url.searchParams.get('topic'), 'topic-one');
  assert.equal(url.searchParams.get('agentId'), 'agent-one');
  assert.equal(url.searchParams.get('source'), 'ios');
  assert.equal(url.searchParams.has('token'), false);
});

test('bare WebView does not shadow cold-launch links, but legacy explicit selections survive', () => {
  assert.equal(native('/webview', {}, base), null);
  assert.equal(native('/', {}, base), null);
  const url = new URL(native('/webview', { topic_id: ['legacy-topic'], agent_id: 'agent-one' }, base));
  assert.equal(url.pathname, '/mobile/feed');
  assert.equal(url.searchParams.get('topic_id'), 'legacy-topic');
  assert.equal(url.searchParams.get('agent_id'), 'agent-one');
});

test('Workspace deep links preserve project and session while hosts links use their own screen', () => {
  const url = new URL(deep('wtt://workspaces?workspace=project&session=session&topic=topic&agentId=agent-one', base));
  assert.equal(url.pathname, '/mobile/workspaces');
  assert.equal(url.searchParams.get('workspace'), 'project');
  assert.equal(url.searchParams.get('session'), 'session');
  assert.equal(new URL(native('/workspaces/hosts', {}, base)).pathname, '/mobile/workspaces/hosts');
  assert.equal(deep('https://untrusted.test/workspaces', base), null);
});
