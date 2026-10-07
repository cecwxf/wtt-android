import { create } from 'zustand';
import { getSecureItem, setSecureItem, deleteSecureItem } from '@/lib/storage/secure-store';
import { WTTApiClient } from '@/lib/api/wtt-client';
import { WTT_API_URL } from '@/lib/api/base-url';
import type { OAuthCodeFlowResult, OAuthProvider } from '@/lib/auth/oauth';
import { startOAuthCodeFlow, exchangeOAuthCode } from '@/lib/auth/oauth';

interface User {
  id: string;
  username: string;
  email: string;
  display_name?: string;
  phone?: string;
  user_id?: string;
  avatar_url?: string;
}

interface RegisterResult {
  ok: boolean;
  message: string;
  phone?: string;
  user_id?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (phone: string, password: string) => Promise<void>;
  loginWithPhoneCode: (phone: string, code: string) => Promise<void>;
  loginWithOAuth: (provider: OAuthProvider, oauth?: OAuthCodeFlowResult) => Promise<void>;
  register: (
    username: string,
    phone: string,
    code: string,
    password: string,
  ) => Promise<RegisterResult>;
  resendActivation: (email: string) => Promise<{ ok: boolean; message: string; email?: string }>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  setToken: (token: string, user?: User) => Promise<void>;
}

const TOKEN_KEY = 'wtt_auth_token';
const USER_KEY = 'wtt_user';
const SESSION_KEY = 'wtt_auth_session_v1';
let sessionRevision = 0;
let sessionWrites: Promise<void> = Promise.resolve();

function writeSession(revision: number, operation: () => Promise<void>) {
  const write = sessionWrites
    .catch(() => undefined)
    .then(async () => {
      if (revision !== sessionRevision) throw new Error('Login superseded');
      await operation();
      if (revision !== sessionRevision) throw new Error('Login superseded');
    });
  sessionWrites = write;
  return write;
}

function normalizeUser(raw: Partial<User> | null | undefined): User | null {
  if (!raw) return null;
  const id = String(raw.id || raw.user_id || '').trim();
  const displayName = String(
    raw.display_name || raw.username || raw.phone || raw.email || '',
  ).trim();
  return {
    id,
    user_id: String(raw.user_id || id),
    username: String(raw.username || displayName || id || 'user'),
    email: String(raw.email || ''),
    display_name: displayName || undefined,
    phone: raw.phone ? String(raw.phone) : undefined,
    avatar_url: raw.avatar_url ? String(raw.avatar_url) : undefined,
  };
}

async function fetchCurrentUser(token: string): Promise<User | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 12000);
  try {
    const res = await fetch(`${WTT_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: abort.signal,
      redirect: 'error',
    });
    if (!res.ok) return null;
    return normalizeUser((await res.json()) as Partial<User>);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function persistSession(
  token: string,
  user: User | null,
  setState: (partial: Partial<AuthState>) => void,
  revision: number,
) {
  const normalized = normalizeUser(user);
  if (!token || !normalized?.id)
    throw new Error('Unable to verify your WTT account. Please retry.');
  await writeSession(revision, async () => {
    await setSecureItem(SESSION_KEY, JSON.stringify({ version: 1, token, user: normalized }));
    await deleteSecureItem(TOKEN_KEY);
    await deleteSecureItem(USER_KEY);
  });
  setState({ token, user: normalized, isAuthenticated: true });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (phone: string, password: string) => {
    const revision = ++sessionRevision;
    const client = new WTTApiClient(WTT_API_URL);
    const data = await client.loginWithPhonePassword(phone.trim(), password);
    const token = data.access_token;
    const user = await fetchCurrentUser(token);
    await persistSession(token, user, set, revision);
  },

  loginWithPhoneCode: async (phone: string, code: string) => {
    const revision = ++sessionRevision;
    const client = new WTTApiClient(WTT_API_URL);
    const data = await client.loginWithPhoneCode(phone.trim(), code.trim());
    const token = data.access_token;
    const user = await fetchCurrentUser(token);
    await persistSession(token, user, set, revision);
  },

  loginWithOAuth: async (provider, oauth) => {
    const revision = ++sessionRevision;
    const flow = oauth || (await startOAuthCodeFlow(provider));
    if (revision !== sessionRevision) throw new Error('Login superseded');
    const client = new WTTApiClient(WTT_API_URL);
    const data = flow.requestTicket
      ? await exchangeOAuthCode(flow)
      : await client.oauthCallback(provider, flow.code, {
          redirect_uri: flow.redirectUri,
          code_verifier: flow.codeVerifier,
        });
    const token = data.access_token;
    if (!token) {
      throw new Error('OAuth login failed: missing access token');
    }

    const fetched = await fetchCurrentUser(token);
    if (flow.requestTicket && (!fetched?.id || !('user_id' in data) || fetched.id !== data.user_id))
      throw new Error('Unable to verify your WTT account. Please retry.');
    await persistSession(token, fetched, set, revision);
  },

  register: async (username: string, phone: string, code: string, password: string) => {
    const client = new WTTApiClient(WTT_API_URL);
    return client.registerWithPhone(username, phone.trim(), code.trim(), password);
  },

  resendActivation: async (email: string) => {
    const client = new WTTApiClient(WTT_API_URL);
    return client.resendActivation(email);
  },

  logout: async () => {
    const token = get().token;
    const revision = ++sessionRevision;
    set({ token: null, user: null, isAuthenticated: false });
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10000);
    try {
      await Promise.all([
        writeSession(revision, async () => {
          // Keep a tombstone so an interrupted logout cannot resurrect legacy keys.
          await setSecureItem(SESSION_KEY, JSON.stringify({ version: 1, token: null, user: null }));
          await deleteSecureItem(TOKEN_KEY);
          await deleteSecureItem(USER_KEY);
        }),
        token
          ? fetch(`${WTT_API_URL}/auth/mobile-web/sessions/revoke-parent`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              signal: abort.signal,
            }).catch(() => undefined)
          : Promise.resolve(),
      ]);
    } finally {
      clearTimeout(timer);
    }
  },

  loadToken: async () => {
    const revision = sessionRevision;
    try {
      const saved = await getSecureItem(SESSION_KEY);
      let token: string | null = null;
      let user: User | null = null;
      if (saved !== null) {
        const session = JSON.parse(saved);
        if (session.version !== 1 || (session.token !== null && typeof session.token !== 'string'))
          throw new Error('Invalid stored session');
        token = session.token;
        user = normalizeUser(session.user);
      } else {
        token = await getSecureItem(TOKEN_KEY);
        if (token) {
          // Old separate keys may be from different logins after an interrupted write.
          user = await fetchCurrentUser(token);
          if (user?.id) await persistSession(token, user, set, revision);
        }
      }
      if (revision !== sessionRevision) return;
      set({
        token: user?.id ? token : null,
        user,
        isAuthenticated: !!token && !!user?.id,
        isLoading: false,
      });
    } catch {
      if (revision === sessionRevision) set({ isLoading: false });
    }
  },

  setToken: async (token: string) => {
    const revision = ++sessionRevision;
    const verified = await fetchCurrentUser(token);
    await persistSession(token, verified, set, revision);
  },
}));
