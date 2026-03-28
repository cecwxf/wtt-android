import { create } from 'zustand';
import { getSecureItem, setSecureItem } from '@/lib/storage/secure-store';

interface AppSettingsState {
  loaded: boolean;
  messageNotify: boolean;
  agentAlert: boolean;
  soundOn: boolean;
  fallbackPollSeconds: 5 | 10 | 15 | 30;
  privacyConsentAccepted: boolean;

  load: () => Promise<void>;
  setMessageNotify: (value: boolean) => Promise<void>;
  setAgentAlert: (value: boolean) => Promise<void>;
  setSoundOn: (value: boolean) => Promise<void>;
  setFallbackPollSeconds: (value: 5 | 10 | 15 | 30) => Promise<void>;
  setPrivacyConsentAccepted: (value: boolean) => Promise<void>;
}

const KEY = 'wtt_mobile_app_settings';

type Persisted = {
  messageNotify?: boolean;
  agentAlert?: boolean;
  soundOn?: boolean;
  fallbackPollSeconds?: 5 | 10 | 15 | 30;
  privacyConsentAccepted?: boolean;
};

async function persist(partial: Partial<Persisted>) {
  const raw = await getSecureItem(KEY);
  const existing: Persisted = raw ? JSON.parse(raw) : {};
  const next: Persisted = { ...existing, ...partial };
  await setSecureItem(KEY, JSON.stringify(next));
}

export const useAppSettingsStore = create<AppSettingsState>((set) => ({
  loaded: false,
  messageNotify: true,
  agentAlert: true,
  soundOn: false,
  fallbackPollSeconds: 10,
  privacyConsentAccepted: false,

  load: async () => {
    const raw = await getSecureItem(KEY);
    if (!raw) {
      set({ loaded: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Persisted;
      set({
        loaded: true,
        messageNotify: parsed.messageNotify ?? true,
        agentAlert: parsed.agentAlert ?? true,
        soundOn: parsed.soundOn ?? false,
        fallbackPollSeconds: parsed.fallbackPollSeconds ?? 10,
        privacyConsentAccepted: parsed.privacyConsentAccepted ?? false,
      });
    } catch {
      // ignore invalid payload
      set({ loaded: true });
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

  setPrivacyConsentAccepted: async (value) => {
    await persist({ privacyConsentAccepted: value });
    set({ privacyConsentAccepted: value });
  },
}));
