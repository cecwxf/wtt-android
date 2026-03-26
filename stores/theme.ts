import { create } from 'zustand';
import { Appearance, type ColorSchemeName } from 'react-native';
import { getSecureItem, setSecureItem } from '@/lib/storage/secure-store';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => Promise<void>;
  loadMode: () => Promise<void>;
}

const THEME_KEY = 'wtt_theme_mode';

function resolve(mode: ThemeMode, system: ColorSchemeName): 'light' | 'dark' {
  if (mode === 'system') return system === 'dark' ? 'dark' : 'light';
  return mode;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  resolved: resolve('system', Appearance.getColorScheme()),

  setMode: async (mode: ThemeMode) => {
    await setSecureItem(THEME_KEY, mode);
    set({ mode, resolved: resolve(mode, Appearance.getColorScheme()) });
  },

  loadMode: async () => {
    const saved = await getSecureItem(THEME_KEY);
    const mode = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
    set({ mode, resolved: resolve(mode, Appearance.getColorScheme()) });
  },
}));

// Listen for system theme changes
Appearance.addChangeListener(({ colorScheme }) => {
  const { mode } = useThemeStore.getState();
  if (mode === 'system') {
    useThemeStore.setState({ resolved: colorScheme === 'dark' ? 'dark' : 'light' });
  }
});
