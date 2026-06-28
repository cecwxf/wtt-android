import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useI18nStore } from '@/stores/i18n';
import { useThemeStore } from '@/stores/theme';
import '../global.css';

SplashScreen.preventAutoHideAsync();

const SPLASH_MIN_VISIBLE_MS = 900;
const splashStartedAt = Date.now();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [prefsReady, setPrefsReady] = useState(false);
  const loadLocale = useI18nStore((s) => s.loadLocale);
  const loadTheme = useThemeStore((s) => s.loadMode);
  const resolvedTheme = useThemeStore((s) => s.resolved);

  const [fontsLoaded, fontError] = useFonts({
    Inter: require('../assets/fonts/Inter.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    JetBrainsMono: require('../assets/fonts/JetBrainsMono.ttf'),
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadLocale(), loadTheme()])
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPrefsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadLocale, loadTheme]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(resolvedTheme === 'dark' ? '#0B1220' : '#F7F8FB');
  }, [resolvedTheme]);

  useEffect(() => {
    let cancelled = false;
    if ((fontsLoaded || fontError) && prefsReady) {
      const elapsed = Date.now() - splashStartedAt;
      const delay = Math.max(SPLASH_MIN_VISIBLE_MS - elapsed, 0);
      const timer = setTimeout(() => {
        if (cancelled) return;
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }, delay);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, fontError, prefsReady]);

  // Use inline styles for the loading screen to avoid NativeWind dependency
  if (!ready && (!fontsLoaded || !prefsReady) && !fontError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: resolvedTheme === 'dark' ? '#0B1220' : '#6366F1',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>
          WTT
        </Text>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="webview" />
      </Stack>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
    </ErrorBoundary>
  );
}
