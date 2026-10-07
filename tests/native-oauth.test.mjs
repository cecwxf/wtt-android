import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url), ts = require('typescript'), module = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('../lib/auth/native-oauth.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(code, { module, exports: module.exports, URL, AbortController, setTimeout, clearTimeout });
const { nativeOAuthFlow, exchangeNativeOAuth } = module.exports;

function fixture({ reply, browser } = {}) {
  let state;
  const calls = [], browsers = [];
  const deps = {
    apiUrl: 'https://api.example.test', webOrigin: 'https://www.ultraspace.ai',
    randomHex: () => randomBytes(32).toString('hex'),
    sha256: async value => createHash('sha256').update(value).digest('base64url'),
    dismissBrowser: () => {},
    fetch: async (url, options) => {
      calls.push([url, options]);
      const body = JSON.parse(options.body);
      if (url.endsWith('/start')) state = body.state;
      return reply ? reply(url, body) : Response.json(url.endsWith('/start')
        ? { request_ticket: 'signed-ticket', authorization_url: deps.webOrigin + '/native-login?request=signed-ticket', expires_in: 600 }
        : { access_token: 'native-token', user_id: 'alice' });
    },
    openBrowser: async (url, callback) => {
      browsers.push([url, callback]);
      return browser ? browser(state) : { type: 'success', url: 'wtt://oauth?' + new URLSearchParams({ code: 'c'.repeat(43), state }) };
    },
  };
  return { deps, calls, browsers };
}

test('all providers use the WTT HTTPS browser broker and S256 with independent secure state', async () => {
  for (const provider of ['github', 'google', 'twitter']) {
    const f = fixture(), result = await nativeOAuthFlow(provider, f.deps);
    const body = JSON.parse(f.calls[0][1].body);
    assert.equal(body.provider, provider);
    assert.equal(body.code_challenge, createHash('sha256').update(result.codeVerifier).digest('base64url'));
    assert.match(body.state, /^[a-f0-9]{64}$/);
    assert.notEqual(body.state, result.codeVerifier);
    assert.equal(f.browsers[0][1], 'wtt://oauth');
    assert.doesNotMatch(f.browsers[0][0], new RegExp(result.codeVerifier));
    const account = await exchangeNativeOAuth(result, f.deps);
    assert.equal(account.access_token, 'native-token');
    assert.equal(account.user_id, 'alice');
    assert.equal(JSON.parse(f.calls[1][1].body).code_verifier, result.codeVerifier);
    assert.equal(f.calls[0][1].redirect, 'error');
  }
});

test('cancelled and dismissed system browsers never exchange credentials', async () => {
  for (const type of ['cancel', 'dismiss']) {
    const f = fixture({ browser: () => ({ type }) });
    await assert.rejects(nativeOAuthFlow('github', f.deps), /OAuth cancelled/);
    assert.equal(f.calls.length, 1);
  }
});

test('wrong state, duplicate code, foreign callback and fragments reject authorization', async () => {
  const callbacks = [state => 'wtt://oauth?code=' + 'c'.repeat(43) + '&state=' + 'b'.repeat(64),
    state => 'https://oauth?code=' + 'c'.repeat(43) + '&state=' + state,
    state => 'wtt://evil?code=' + 'c'.repeat(43) + '&state=' + state,
    state => 'wtt://oauth?code=' + 'c'.repeat(43) + '&state=' + state + '&code=' + 'c'.repeat(43),
    state => 'wtt://oauth?code=' + 'c'.repeat(43) + '&state=' + state + '#extra',
    state => 'wtt://user@oauth?code=' + 'c'.repeat(43) + '&state=' + state];
  for (const url of callbacks) {
    const f = fixture({ browser: state => ({ type: 'success', url: url(state) }) });
    await assert.rejects(nativeOAuthFlow('github', f.deps), /Invalid OAuth callback/);
  }
});

test('untrusted broker destinations and response expiry never open a browser', async () => {
  for (const changes of [{ authorization_url: 'https://www.ultraspace.ai.evil.test/native-login?request=signed-ticket' },
    { authorization_url: 'https://www.ultraspace.ai/native-login?request=signed-ticket&request=extra' },
    { authorization_url: 'https://user@www.ultraspace.ai/native-login?request=signed-ticket' },
    { authorization_url: 'https://www.ultraspace.ai/feed?request=signed-ticket' }, { expires_in: 999999 }]) {
    const f = fixture({ reply: () => Response.json({ request_ticket: 'signed-ticket',
      authorization_url: 'https://www.ultraspace.ai/native-login?request=signed-ticket', expires_in: 600, ...changes }) });
    await assert.rejects(nativeOAuthFlow('github', f.deps), /Invalid login/);
    assert.equal(f.browsers.length, 0);
  }
});

test('browser request expiry is bounded and dismisses the active auth session', async () => {
  let dismissed = false;
  const f = fixture({ reply: () => Response.json({ request_ticket: 'signed-ticket',
    authorization_url: 'https://www.ultraspace.ai/native-login?request=signed-ticket', expires_in: 1 }),
    browser: () => new Promise(() => {}) });
  f.deps.dismissBrowser = () => { dismissed = true; };
  await assert.rejects(nativeOAuthFlow('github', f.deps), /expired/);
  assert.equal(dismissed, true);
});

test('HTTP failures redact upstream secrets and malformed account responses cannot persist', async () => {
  const f = fixture({ reply: () => Response.json({ detail: 'private-secret' }, { status: 500 }) });
  await assert.rejects(nativeOAuthFlow('github', f.deps), error => /Login request failed/.test(error.message) && !error.message.includes('private-secret'));
  const flow = { code: 'c'.repeat(43), redirectUri: 'wtt://oauth', requestTicket: 'signed-ticket', codeVerifier: 'v'.repeat(43) };
  const invalid = fixture({ reply: () => Response.json({ access_token: 'token' }) });
  await assert.rejects(exchangeNativeOAuth(flow, invalid.deps), /Invalid native account response/);
});
