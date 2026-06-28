import { useMemo } from 'react';
import { useThemeStore } from '@/stores/theme';

export type AppTheme = ReturnType<typeof createAppTheme>;

function createAppTheme(dark: boolean) {
  return {
    dark,
    accent: '#6366F1',
    accentStrong: '#4F46E5',
    background: dark ? '#0B1220' : '#F7F8FB',
    surface: dark ? '#111827' : '#FFFFFF',
    surfaceAlt: dark ? '#172033' : '#F8FAFC',
    surfaceMuted: dark ? '#1E293B' : '#F1F5F9',
    text: dark ? '#F8FAFC' : '#0F172A',
    textMuted: dark ? '#CBD5E1' : '#475569',
    textSubtle: dark ? '#94A3B8' : '#64748B',
    border: dark ? '#263244' : '#E2E8F0',
    borderSoft: dark ? '#1E293B' : '#E5E7EB',
    placeholder: dark ? '#64748B' : '#94A3B8',
    primaryButtonText: '#FFFFFF',
  };
}

export function useAppTheme() {
  const resolved = useThemeStore((s) => s.resolved);
  return useMemo(() => createAppTheme(resolved === 'dark'), [resolved]);
}
