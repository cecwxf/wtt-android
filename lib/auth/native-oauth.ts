export type OAuthProvider = 'github' | 'google' | 'twitter';
export type OAuthCodeFlowResult = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  requestTicket?: string;
};
type BrowserResult = { type: string; url?: string };
type Dependencies = {
  apiUrl: string;
  webOrigin: string;
  randomHex: () => string;
  sha256: (value: string) => Promise<string>;
  openBrowser: (url: string, callback: string) => Promise<BrowserResult>;
  dismissBrowser: () => void;
  fetch?: typeof fetch;
};
export const OAUTH_CALLBACK = 'wtt://oauth';

function secureOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password)
    throw new Error('Invalid login service');
  return value;
}

async function post(deps: Dependencies, action: string, body: Record<string, unknown>) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 12000);
  try {
    const response = await (deps.fetch || fetch)(
      `${secureOrigin(deps.apiUrl)}/auth/native-login/${action}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'error',
        signal: abort.signal,
      },
    );
    if (!response.ok) throw new Error('Login request failed. Please restart login.');
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function nativeOAuthFlow(
  provider: OAuthProvider,
  deps: Dependencies,
): Promise<OAuthCodeFlowResult> {
  const webOrigin = secureOrigin(deps.webOrigin);
  const state = deps.randomHex(),
    verifier = deps.randomHex();
  if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(verifier) || state === verifier)
    throw new Error('Unable to generate secure login proof');
  const challenge = await deps.sha256(verifier);
  if (!/^[\w-]{43}$/.test(challenge)) throw new Error('Invalid login proof');
  const start = await post(deps, 'start', {
    provider,
    state,
    code_challenge: challenge,
    web_origin: webOrigin,
  });
  if (
    typeof start.request_ticket !== 'string' ||
    !start.request_ticket.length ||
    start.request_ticket.length > 2048 ||
    typeof start.authorization_url !== 'string' ||
    start.authorization_url.length > 4096 ||
    !Number.isInteger(start.expires_in) ||
    start.expires_in < 1 ||
    start.expires_in > 600
  )
    throw new Error('Invalid login response');
  const url = new URL(start.authorization_url);
  if (
    url.origin !== webOrigin ||
    url.pathname !== '/native-login' ||
    url.username ||
    url.password ||
    url.hash ||
    Array.from(url.searchParams.keys()).join(',') !== 'request' ||
    url.searchParams.get('request') !== start.request_ticket
  )
    throw new Error('Invalid login destination');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        deps.dismissBrowser();
      } catch {
        /* Proof still expires even if closing the browser fails. */
      }
      reject(new Error('Login request expired. Please restart login.'));
    }, start.expires_in * 1000);
  });
  let result: BrowserResult;
  try {
    result = await Promise.race([deps.openBrowser(url.toString(), OAUTH_CALLBACK), timedOut]);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (result.type === 'cancel' || result.type === 'dismiss') throw new Error('OAuth cancelled');
  if (result.type !== 'success' || !result.url || result.url.length > 512)
    throw new Error('OAuth failed');
  const callback = new URL(result.url);
  if (
    callback.protocol !== 'wtt:' ||
    callback.hostname !== 'oauth' ||
    callback.pathname ||
    callback.port ||
    callback.username ||
    callback.password ||
    callback.hash ||
    Array.from(callback.searchParams.keys()).sort().join(',') !== 'code,state' ||
    callback.searchParams.get('state') !== state ||
    !/^[\w-]{43}$/.test(callback.searchParams.get('code') || '')
  )
    throw new Error('Invalid OAuth callback');
  return {
    code: callback.searchParams.get('code')!,
    redirectUri: OAUTH_CALLBACK,
    codeVerifier: verifier,
    requestTicket: start.request_ticket,
  };
}

export async function exchangeNativeOAuth(flow: OAuthCodeFlowResult, deps: Dependencies) {
  if (flow.redirectUri !== OAUTH_CALLBACK || !flow.requestTicket || !flow.codeVerifier)
    throw new Error('Invalid native login proof');
  const result = await post(deps, 'exchange', {
    request_ticket: flow.requestTicket,
    code: flow.code,
    code_verifier: flow.codeVerifier,
    web_origin: secureOrigin(deps.webOrigin),
  });
  if (
    typeof result.access_token !== 'string' ||
    !result.access_token.length ||
    result.access_token.length > 8192 ||
    typeof result.user_id !== 'string' ||
    !result.user_id
  )
    throw new Error('Invalid native account response');
  return { access_token: result.access_token as string, user_id: result.user_id as string };
}
