import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'github' | 'google' | 'twitter';

export type OAuthCodeFlowResult = {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
};

type OAuthExtra = {
  githubClientId?: string;
  googleClientId?: string;
  twitterClientId?: string;
  redirectUri?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as { oauth?: OAuthExtra };
const oauth = extra.oauth ?? {};

const REDIRECT_URI = oauth.redirectUri || Linking.createURL('oauth');

const providerConfig: Record<
  OAuthProvider,
  { authorizeUrl: string; clientId?: string; scope: string; extraParams?: Record<string, string> }
> = {
  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    clientId: oauth.githubClientId,
    scope: 'read:user user:email',
    extraParams: {
      allow_signup: 'true',
    },
  },
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: oauth.googleClientId,
    scope: 'openid email profile',
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  twitter: {
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    clientId: oauth.twitterClientId,
    scope: 'tweet.read users.read offline.access',
    extraParams: {
      code_challenge_method: 'plain',
    },
  },
};

function randomState() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomCodeVerifier() {
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function requireClientId(provider: OAuthProvider): string {
  const clientId = providerConfig[provider].clientId?.trim();
  if (!clientId) {
    throw new Error(`Missing OAuth client id for ${provider}`);
  }
  return clientId;
}

export function isOAuthProviderEnabled(provider: OAuthProvider): boolean {
  return !!providerConfig[provider].clientId?.trim();
}

function buildAuthorizeUrl(provider: OAuthProvider, state: string, codeVerifier?: string) {
  const conf = providerConfig[provider];
  const clientId = requireClientId(provider);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: conf.scope,
    state,
  });

  Object.entries(conf.extraParams || {}).forEach(([key, value]) => {
    params.set(key, value);
  });

  if (provider === 'twitter' && codeVerifier) {
    params.set('code_challenge', codeVerifier);
  }

  return `${conf.authorizeUrl}?${params.toString()}`;
}

export async function startOAuthCodeFlow(provider: OAuthProvider): Promise<OAuthCodeFlowResult> {
  const state = randomState();
  const codeVerifier = provider === 'twitter' ? randomCodeVerifier() : undefined;
  const authUrl = buildAuthorizeUrl(provider, state, codeVerifier);

  const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('OAuth cancelled');
  }

  if (result.type !== 'success' || !result.url) {
    throw new Error('OAuth failed');
  }

  const parsed = Linking.parse(result.url);
  const params = (parsed.queryParams || {}) as Record<string, string | undefined>;

  if (params.error) {
    throw new Error(params.error_description || params.error || 'OAuth provider error');
  }

  if (!params.state || params.state !== state) {
    throw new Error('OAuth state mismatch');
  }

  const code = params.code;
  if (!code) {
    throw new Error('OAuth code missing');
  }

  return {
    code,
    redirectUri: REDIRECT_URI,
    ...(codeVerifier ? { codeVerifier } : {}),
  };
}

export function getOAuthRedirectUri() {
  return REDIRECT_URI;
}
