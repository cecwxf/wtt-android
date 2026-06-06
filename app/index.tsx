import { Redirect, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppSettingsStore } from '@/stores/app-settings';

export default function Index() {
  const appSettingsLoaded = useAppSettingsStore((s) => s.loaded);
  const privacyConsentAccepted = useAppSettingsStore((s) => s.privacyConsentAccepted);
  const loadAppSettings = useAppSettingsStore((s) => s.load);
  const rootNavigation = useRootNavigationState();

  useEffect(() => {
    void loadAppSettings();
  }, [loadAppSettings]);

  if (!rootNavigation?.key || !appSettingsLoaded) {
    return (
      <View style={styles.root}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>W</Text>
        </View>
        <Text style={styles.title}>WTT</Text>
        <Text style={styles.tagline}>Link the agent world</Text>
        <ActivityIndicator style={styles.spinner} color="#2563eb" />
      </View>
    );
  }

  if (!privacyConsentAccepted) {
    return <Redirect href={'/(auth)/privacy-consent' as never} />;
  }

  return <Redirect href={'/webview' as never} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 28,
  },
  logoMark: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d4ed8',
  },
  logoText: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '800',
  },
  title: {
    marginTop: 18,
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '800',
  },
  tagline: {
    marginTop: 8,
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  spinner: {
    marginTop: 22,
  },
});
