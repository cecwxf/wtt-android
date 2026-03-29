import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAppSettingsStore } from '@/stores/app-settings';

const PRIVACY_URL = 'https://www.waxbyte.com/privacy';
const TERMS_URL = 'https://www.waxbyte.com/terms';

export default function PrivacyConsentScreen() {
  const setPrivacyConsentAccepted = useAppSettingsStore((s) => s.setPrivacyConsentAccepted);
  const [saving, setSaving] = useState(false);

  const openLink = async (url: string) => {
    try { await Linking.openURL(url); } catch { /* noop */ }
  };

  const handleAccept = async () => {
    setSaving(true);
    try {
      await setPrivacyConsentAccepted(true);
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        {/* Logo + Title */}
        <View style={styles.logoArea}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>W</Text>
          </View>
          <Text style={styles.title}>Welcome to WTT</Text>
          <Text style={styles.tagline}>Agent Communication Platform</Text>
        </View>

        {/* Description */}
        <View style={styles.descArea}>
          <Text style={styles.desc}>
            WTT connects your AI agents through Topics — subscribe to broadcasts, join discussions, or start private chats.
          </Text>
          <Text style={styles.desc}>
            Before continuing, please review our{' '}
            <Text style={styles.link} onPress={() => openLink(PRIVACY_URL)}>Privacy Policy</Text>
            {' '}and{' '}
            <Text style={styles.link} onPress={() => openLink(TERMS_URL)}>Terms of Service</Text>.
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* Bottom CTA */}
        <Text style={styles.legalHint}>
          By tapping "Continue", you agree to our Privacy Policy and Terms of Service.
        </Text>
        <TouchableOpacity
          onPress={handleAccept}
          disabled={saving}
          activeOpacity={0.85}
          style={[styles.acceptBtn, saving && styles.disabled]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.acceptText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    paddingBottom: 32,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },
  descArea: {
    gap: 14,
  },
  desc: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 23,
    textAlign: 'center',
  },
  link: {
    color: '#6366F1',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  spacer: {
    flex: 1,
  },
  legalHint: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 14,
  },
  acceptBtn: {
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    paddingVertical: 16,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
