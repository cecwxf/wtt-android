import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useWebSocketStore } from '@/stores/websocket';
import { useThemeStore } from '@/stores/theme';
import { useI18nStore } from '@/stores/i18n';
import { WS_BASE_URL } from '@/lib/api/base-url';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const resolved = useThemeStore((s) => s.resolved);
  const loadTheme = useThemeStore((s) => s.loadMode);
  const loadLocale = useI18nStore((s) => s.loadLocale);
  const loadToken = useAuthStore((s) => s.loadToken);
  const isLoading = useAuthStore((s) => s.isLoading);
  const token = useAuthStore((s) => s.token);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const wsInitialize = useWebSocketStore((s) => s.initialize);
  const wsDisconnect = useWebSocketStore((s) => s.disconnect);

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
    // Safety: force splash hide after 5s to prevent infinite blank screen
    const timeout = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 5000);
    return () => clearTimeout(timeout);
  }, [loadToken, loadTheme, loadLocale]);

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
    // Hide splash when fonts are loaded (or failed) AND auth check is done
    if ((fontsLoaded || fontError) && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isLoading]);

  if (!fontsLoaded && !fontError) {
    // Fonts still loading — keep splash screen up
    return null;
  }

  if (isLoading) {
    // Auth still loading — keep splash screen up
    return null;
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
