import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { WTTApiClient } from '@/lib/api/wtt-client';
import { WTT_API_URL } from '@/lib/api/base-url';

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
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  setToken: (token: string, user?: User) => Promise<void>;
}

const TOKEN_KEY = 'wtt_auth_token';
const USER_KEY = 'wtt_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    const client = new WTTApiClient(WTT_API_URL);
    const data = await client.login(email, password);
    const token = data.access_token;
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, isAuthenticated: true });
    // Fetch user profile
    try {
      const res = await fetch(`${WTT_API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
        set({ user });
      }
    } catch { /* ignore */ }
  },

  register: async (username: string, email: string, password: string) => {
    const client = new WTTApiClient(WTT_API_URL);
    await client.register(username, email, password);
    // Auto-login after register
    await get().login(email, password);
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userStr = await SecureStore.getItemAsync(USER_KEY);
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
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, user: user ?? get().user, isAuthenticated: true });
  },
}));
