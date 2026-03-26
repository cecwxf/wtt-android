import { create } from 'zustand';
import { getSecureItem, setSecureItem } from '@/lib/storage/secure-store';

interface AppSettingsState {
  messageNotify: boolean;
  agentAlert: boolean;
  soundOn: boolean;
  fallbackPollSeconds: 5 | 10 | 15 | 30;

  load: () => Promise<void>;
  setMessageNotify: (value: boolean) => Promise<void>;
  setAgentAlert: (value: boolean) => Promise<void>;
  setSoundOn: (value: boolean) => Promise<void>;
  setFallbackPollSeconds: (value: 5 | 10 | 15 | 30) => Promise<void>;
}

const KEY = 'wtt_mobile_app_settings';

type Persisted = {
  messageNotify?: boolean;
  agentAlert?: boolean;
  soundOn?: boolean;
  fallbackPollSeconds?: 5 | 10 | 15 | 30;
};

async function persist(partial: Partial<Persisted>) {
  const raw = await getSecureItem(KEY);
  const existing: Persisted = raw ? JSON.parse(raw) : {};
  const next: Persisted = { ...existing, ...partial };
  await setSecureItem(KEY, JSON.stringify(next));
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  messageNotify: true,
  agentAlert: true,
  soundOn: false,
  fallbackPollSeconds: 10,

  load: async () => {
    const raw = await getSecureItem(KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Persisted;
      set({
        messageNotify: parsed.messageNotify ?? true,
        agentAlert: parsed.agentAlert ?? true,
        soundOn: parsed.soundOn ?? false,
        fallbackPollSeconds: parsed.fallbackPollSeconds ?? 10,
      });
    } catch {
      // ignore invalid payload
    }
  },

  setMessageNotify: async (value) => {
    await persist({ messageNotify: value });
    set({ messageNotify: value });
  },

  setAgentAlert: async (value) => {
    await persist({ agentAlert: value });
    set({ agentAlert: value });
  },

  setSoundOn: async (value) => {
    await persist({ soundOn: value });
    set({ soundOn: value });
  },

  setFallbackPollSeconds: async (value) => {
    await persist({ fallbackPollSeconds: value });
    set({ fallbackPollSeconds: value });
  },
}));
