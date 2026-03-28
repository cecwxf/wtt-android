import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  SafeAreaView,
  ScrollView,
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

  const handleOpen = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // noop
    }
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Welcome to WTT</Text>
        <Text style={styles.subtitle}>Privacy & Terms Consent</Text>

        <View style={styles.card}>
          <Text style={styles.paragraph}>
            To comply with app store privacy requirements, please read and accept the following
            before continuing:
          </Text>
          <Text style={styles.bullet}>• Privacy Policy (data collection and processing)</Text>
          <Text style={styles.bullet}>• Terms of Service (usage rules and responsibilities)</Text>

          <TouchableOpacity onPress={() => handleOpen(PRIVACY_URL)} style={styles.linkBtn}>
            <Text style={styles.linkText}>View Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleOpen(TERMS_URL)} style={styles.linkBtn}>
            <Text style={styles.linkText}>View Terms of Service</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          By tapping “Agree and Continue”, you acknowledge that you have read and agree to the
          Privacy Policy and Terms of Service.
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
            <Text style={styles.acceptText}>Agree and Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748B',
  },
  card: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  paragraph: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
    marginBottom: 10,
  },
  bullet: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 6,
  },
  linkBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkText: {
    color: '#4338CA',
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    marginTop: 18,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  acceptBtn: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    paddingVertical: 14,
  },
  acceptText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.7,
  },
});
