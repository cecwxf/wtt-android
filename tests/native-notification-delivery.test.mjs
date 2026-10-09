import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

function fixture() {
  const module = { exports: {} };
  let handler;
  let user = { id: 'alice' };
  const notifications = { setNotificationHandler: value => { handler = value; } };
  const code = ts.transpileModule(readFileSync(new URL('../lib/notifications/native-notifications.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, console,
    require: name => {
      if (name === 'expo-notifications') return notifications;
      if (name === 'expo-file-system') return { documentDirectory: 'file:///fixture/' };
      if (name === 'react-native') return { AppState: { currentState: 'active' }, Platform: { OS: 'android' } };
      if (name === '@/stores/auth') return { useAuthStore: { getState: () => ({ user, token: 'synthetic-token' }) } };
      if (name === './native-push') return { pushStatus: () => 'off' };
      throw new Error(`Unexpected module ${name}`);
    },
  });
  return { handler, user: value => { user = value; } };
}

test('the Expo Android raw handler and mapped iOS handler display only this account notices', async () => {
  const f = fixture();
  const data = { kind: 'wtt-chat', userId: 'alice', messageId: 'one', agentId: 'agent-one', topicId: 'topic-one' };
  const notice = content => ({ request: { identifier: 'notice-one', content } });
  // Expo 0.29 Android NotificationSerializer uses dataString; its handler does not map it.
  const android = await f.handler.handleNotification(notice({ dataString: JSON.stringify(data), sound: null }));
  assert.equal(android.shouldShowAlert, true);
  assert.equal(android.shouldPlaySound, false);
  assert.equal((await f.handler.handleNotification(notice({ data, sound: 'default' }))).shouldShowAlert, true);
  assert.equal((await f.handler.handleNotification(notice({ data: { ...data, delivery: 'push' }, sound: 'default' }))).shouldShowAlert, false);
  f.user({ id: 'bob' });
  const other = await f.handler.handleNotification(notice({ dataString: JSON.stringify(data), sound: 'default' }));
  assert.equal(other.shouldShowAlert, false);
  assert.equal(other.shouldPlaySound, false);
  for (const content of [
    { dataString: '{' }, { dataString: '[]' }, { dataString: 'null' },
    { dataString: JSON.stringify({ ...data, userId: 'bob', kind: 'unknown' }) },
    { data: { kind: 'unknown' }, dataString: JSON.stringify({ ...data, userId: 'bob' }) },
  ]) assert.equal((await f.handler.handleNotification(notice(content))).shouldShowAlert, false);
});
