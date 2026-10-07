import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const ts = createRequire(import.meta.url)('typescript');
const module = { exports: {} };
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../lib/navigation/launch-link.ts', import.meta.url), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    },
  ).outputText,
  { module, exports: module.exports },
);
const { LaunchLink } = module.exports;

test('the current router destination wins over the old OS launch URL', async () => {
  const link = new LaunchLink();
  let reads = 0;
  const read = async () => {
    reads++;
    return 'wtt://login';
  };
  assert.equal(
    await link.readInitial(read, 'https://www.ultraspace.ai/mobile/feed?topic_id=new'),
    null,
  );
  assert.equal(await link.readInitial(read, null), null);
  assert.equal(reads, 0);
});

test('a cold webview may consume its launch URL once, not on every remount', async () => {
  const link = new LaunchLink();
  let reads = 0;
  const read = async () => {
    reads++;
    return 'wtt://settings';
  };
  assert.equal(await link.readInitial(read, null), 'wtt://settings');
  assert.equal(await link.readInitial(read, null), null);
  assert.equal(reads, 1);
});

test('a live navigation discards an initial URL which resolves late', async () => {
  const link = new LaunchLink();
  let resolve;
  const pending = link.readInitial(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
    null,
  );
  link.observeNavigation();
  resolve('wtt://chat/old');
  assert.equal(await pending, null);
});

test('failed launch URL lookup is not retried on subsequent remounts', async () => {
  const link = new LaunchLink();
  await assert.rejects(
    link.readInitial(async () => {
      throw new Error('OS unavailable');
    }, null),
  );
  assert.equal(await link.readInitial(async () => 'wtt://chat/old', null), null);
});
