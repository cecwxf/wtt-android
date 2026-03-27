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
  avatar_url?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  loginWithOAuth: (provider: OAuthProvider, oauth: OAuthCodeFlowResult) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  setToken: (token: string, user?: User) => Promise<void>;
}

const TOKEN_KEY = 'wtt_auth_token';
const USER_KEY = 'wtt_user';

async function fetchCurrentUser(token: string): Promise<User | null> {
  try {
    const res = await fetch(`${WTT_API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as User;
  } catch {
    return null;
  }
}

async function persistSession(token: string, user: User | null, setState: (partial: Partial<AuthState>) => void) {
  await setSecureItem(TOKEN_KEY, token);
  if (user) {
    await setSecureItem(USER_KEY, JSON.stringify(user));
  } else {
    await deleteSecureItem(USER_KEY);
  }
  setState({ token, user, isAuthenticated: true });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const client = new WTTApiClient(WTT_API_URL);
    const data = await client.login(email, password);
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

  register: async (username: string, email: string, password: string) => {
    const client = new WTTApiClient(WTT_API_URL);
    await client.register(username, email, password);
    // Auto-login after register
    await get().login(email, password);
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
      const user = userStr ? JSON.parse(userStr) : null;
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
    await setSecureItem(TOKEN_KEY, token);
    if (user) await setSecureItem(USER_KEY, JSON.stringify(user));
    set({ token, user: user ?? get().user, isAuthenticated: true });
  },
}));
