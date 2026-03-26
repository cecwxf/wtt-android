import { create } from 'zustand';
import en from '@/i18n/en.json';
import { getSecureItem, setSecureItem } from '@/lib/storage/secure-store';
import zh from '@/i18n/zh.json';

type Locale = 'en' | 'zh';

const translations: Record<Locale, typeof en> = { en, zh };

interface I18nState {
  locale: Locale;
  t: typeof en;
  setLocale: (locale: Locale) => Promise<void>;
  loadLocale: () => Promise<void>;
}

const LOCALE_KEY = 'wtt_locale';

export const useI18nStore = create<I18nState>((set) => ({
  locale: 'en',
  t: en,

  setLocale: async (locale: Locale) => {
    await setSecureItem(LOCALE_KEY, locale);
    set({ locale, t: translations[locale] });
  },

  loadLocale: async () => {
    const saved = await getSecureItem(LOCALE_KEY);
    const locale: Locale = saved === 'zh' ? 'zh' : 'en';
    set({ locale, t: translations[locale] });
  },
}));
