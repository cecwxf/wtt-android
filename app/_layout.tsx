import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Inter: require('../assets/fonts/Inter.ttf'),
    'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
    'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
    JetBrainsMono: require('../assets/fonts/JetBrainsMono.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      setReady(true);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="webview" />
      </Stack>
      <StatusBar style="dark" />
    </ErrorBoundary>
  );
}
