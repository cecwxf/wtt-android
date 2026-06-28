import { create } from 'zustand';
import { getSecureItem, setSecureItem, deleteSecureItem } from '@/lib/storage/secure-store';
import { WTTApiClient } from '@/lib/api/wtt-client';
import { WTT_API_URL } from '@/lib/api/base-url';
import type { OAuthCodeFlowResult, OAuthProvider } from '@/lib/auth/oauth';

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
  loginWithOAuth: (provider: OAuthProvider, oauth: OAuthCodeFlowResult) => Promise<void>;
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

function normalizeUser(raw: Partial<User> | null | undefined): User | null {
  if (!raw) return null;
  const id = String(raw.id || raw.user_id || '').trim();
  const displayName = String(raw.display_name || raw.username || raw.phone || raw.email || '').trim();
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
  try {
    const res = await fetch(`${WTT_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return normalizeUser((await res.json()) as Partial<User>);
  } catch {
    return null;
  }
}

async function persistSession(
  token: string,
  user: User | null,
  setState: (partial: Partial<AuthState>) => void,
) {
  const normalized = normalizeUser(user);
  await setSecureItem(TOKEN_KEY, token);
  if (normalized) {
    await setSecureItem(USER_KEY, JSON.stringify(normalized));
  } else {
    await deleteSecureItem(USER_KEY);
  }
  setState({ token, user: normalized, isAuthenticated: true });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (phone: string, password: string) => {
    const client = new WTTApiClient(WTT_API_URL);
    const data = await client.loginWithPhonePassword(phone.trim(), password);
    const token = data.access_token;
    const user = await fetchCurrentUser(token);
    await persistSession(token, user, set);
  },

  loginWithPhoneCode: async (phone: string, code: string) => {
    const client = new WTTApiClient(WTT_API_URL);
    const data = await client.loginWithPhoneCode(phone.trim(), code.trim());
    const token = data.access_token;
    const user = await fetchCurrentUser(token);
    await persistSession(token, user, set);
  },

  loginWithOAuth: async (provider, oauth) => {
    const client = new WTTApiClient(WTT_API_URL);
    const data = await client.oauthCallback(provider, oauth.code, {
      redirect_uri: oauth.redirectUri,
      code_verifier: oauth.codeVerifier,
    });
    const token = data.access_token;
    if (!token) {
      throw new Error('OAuth login failed: missing access token');
    }

    const userFromOAuth = data.user
      ? {
          id: data.user.id ?? '',
          username: data.user.name ?? data.user.email ?? 'oauth_user',
          email: data.user.email ?? '',
          display_name: data.user.name,
          avatar_url: data.user.avatar,
        }
      : null;

    const fetched = await fetchCurrentUser(token);
    const user = fetched || userFromOAuth;
    await persistSession(token, user, set);
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
    await deleteSecureItem(TOKEN_KEY);
    await deleteSecureItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadToken: async () => {
    try {
      const token = await getSecureItem(TOKEN_KEY);
      const userStr = await getSecureItem(USER_KEY);
      let user = normalizeUser(userStr ? JSON.parse(userStr) : null);
      if (token && (!user || !user.id)) {
        user = await fetchCurrentUser(token);
        if (user) await setSecureItem(USER_KEY, JSON.stringify(user));
      }
      set({
        token,
        user,
        isAuthenticated: !!token,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setToken: async (token: string, user?: User) => {
    const normalized = normalizeUser(user) || normalizeUser(get().user);
    await setSecureItem(TOKEN_KEY, token);
    if (normalized) await setSecureItem(USER_KEY, JSON.stringify(normalized));
    set({ token, user: normalized, isAuthenticated: true });
  },
}));
