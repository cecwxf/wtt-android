import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useWebSocketStore } from '@/stores/websocket';
import { useThemeStore } from '@/stores/theme';
import { useI18nStore } from '@/stores/i18n';
import { useAppSettingsStore } from '@/stores/app-settings';
import { WS_BASE_URL } from '@/lib/api/base-url';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const resolved = useThemeStore((s) => s.resolved);
  const loadTheme = useThemeStore((s) => s.loadMode);
  const loadLocale = useI18nStore((s) => s.loadLocale);
  const loadToken = useAuthStore((s) => s.loadToken);
  const isLoading = useAuthStore((s) => s.isLoading);
  const loadAppSettings = useAppSettingsStore((s) => s.load);
  const appSettingsLoaded = useAppSettingsStore((s) => s.loaded);
  const privacyConsentAccepted = useAppSettingsStore((s) => s.privacyConsentAccepted);
  const token = useAuthStore((s) => s.token);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const wsInitialize = useWebSocketStore((s) => s.initialize);
  const wsDisconnect = useWebSocketStore((s) => s.disconnect);
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Inter: require('../assets/fonts/Inter.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    JetBrainsMono: require('../assets/fonts/JetBrainsMono.ttf'),
  });

  useEffect(() => {
    loadToken();
    loadTheme();
    loadLocale();
    loadAppSettings();
    // Safety: force ready after 2s to prevent infinite blank screen
    const timeout = setTimeout(() => {
      console.warn('[WTT] Safety timeout — forcing app visible');
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    }, 2000);
    return () => clearTimeout(timeout);
  }, [loadToken, loadTheme, loadLocale, loadAppSettings]);

  // Initialize WebSocket when authenticated with a selected agent
  useEffect(() => {
    if (token && selectedAgentId) {
      wsInitialize(`${WS_BASE_URL}/ws/${selectedAgentId}`, token);
    } else {
      wsDisconnect();
    }
    return () => wsDisconnect();
  }, [token, selectedAgentId, wsInitialize, wsDisconnect]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && !isLoading) {
      setReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isLoading]);

  // Use inline styles for the loading screen to avoid NativeWind dependency
  if (!ready && !fontsLoaded && !fontError) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#6366F1',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>
          WTT
        </Text>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  // Compliance gate: require first-launch privacy consent before entering app flows.
  if (ready && appSettingsLoaded && !privacyConsentAccepted && pathname !== '/(auth)/privacy-consent') {
    return <Redirect href={'/(auth)/privacy-consent' as never} />;
  }
  if (ready && appSettingsLoaded && privacyConsentAccepted && pathname === '/(auth)/privacy-consent') {
    return <Redirect href="/" />;
  }

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="chat/[id]"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="agent/claim"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Claim Agent',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="topic/create"
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Create Topic',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
    </ErrorBoundary>
  );
}
