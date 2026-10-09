import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const ts = createRequire(import.meta.url)('typescript'), module = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('../lib/navigation/auth-entry.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(code, { module, exports: module.exports, URL });
const { authResumeUrl } = module.exports, origin = 'https://www.ultraspace.ai';
test('login resumes a fixed WTT workspace route and drops unexpected credentials', () => {
  assert.equal(authResumeUrl(origin + '/mobile/feed?topic_id=topic&agent_id=agent&source=ios&token=secret', origin),
    origin + '/mobile/feed?topic_id=topic&agent_id=agent&source=ios');
  assert.equal(authResumeUrl(origin + '/mobile/settings', origin), origin + '/mobile/settings');
  assert.equal(authResumeUrl(origin + '/mobile/workspaces?workspace=project&session=one&topic=topic&agentId=agent&token=secret', origin),
    origin + '/mobile/workspaces?workspace=project&session=one&topic=topic&agentId=agent');
  assert.equal(authResumeUrl(origin + '/mobile/workspaces/hosts?workspace=project&source=ios', origin),
    origin + '/mobile/workspaces/hosts?source=ios');
});
test('login cannot resume a foreign site, OAuth page, preview or duplicate route parameters', () => {
  for (const value of [undefined, origin + '.evil.test/mobile/feed', 'http://www.ultraspace.ai/mobile/feed',
    origin + '/native-login?request=secret', origin + '/mobile/feed#secret',
    'https://user@www.ultraspace.ai/mobile/feed', origin + '/mobile/feed?topic_id=a&topic_id=b',
    origin + '/mobile/workspaces?workspace=a&workspace=b', origin + '/mobile/workspaces/preview']) {
    assert.equal(authResumeUrl(value, origin), null);
  }
});
