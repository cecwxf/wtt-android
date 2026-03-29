import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { WTTApiClient } from '@/lib/api/wtt-client';
import { WTT_API_URL } from '@/lib/api/base-url';

function parseMobileLoginPayload(raw: string): { sid: string; nonce: string } | null {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    const json = JSON.parse(text) as { sid?: string; nonce?: string };
    if (json?.sid && json?.nonce) return { sid: String(json.sid), nonce: String(json.nonce) };
  } catch {
    // ignore non-json payloads
  }

  try {
    const url = new URL(text);
    const sid = url.searchParams.get('sid');
    const nonce = url.searchParams.get('nonce');
    if (sid && nonce) return { sid, nonce };
  } catch {
    // ignore malformed URL
  }

  const sidMatch = text.match(/[?&]sid=([^&#]+)/i);
  const nonceMatch = text.match(/[?&]nonce=([^&#]+)/i);
  if (sidMatch?.[1] && nonceMatch?.[1]) {
    return {
      sid: decodeURIComponent(sidMatch[1]),
      nonce: decodeURIComponent(nonceMatch[1]),
    };
  }

  return null;
}

export default function QrLoginScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [manualPayload, setManualPayload] = useState('');
  const [scanned, setScanned] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const appVersion = useMemo(() => String(Constants.expoConfig?.version || 'unknown'), []);

  const submitPayload = async (payloadText: string) => {
    const parsed = parseMobileLoginPayload(payloadText);
    if (!parsed) {
      Alert.alert('Invalid QR', '无法识别二维码内容，请重新扫码或复制完整链接。');
      return;
    }

    setBusy(true);
    try {
      const client = new WTTApiClient(WTT_API_URL);
      const data = await client.approveMobileLoginSession(parsed.sid, parsed.nonce, {
        platform: Platform.OS,
        app_version: appVersion,
        device_name: `${Platform.OS}-mobile`,
      });

      if (!data.access_token) {
        throw new Error('Missing access token from mobile login session');
      }

      const user = data.user
        ? {
            id: data.user.id || '',
            username: data.user.display_name || data.user.name || data.user.email || 'user',
            email: data.user.email || '',
            display_name: data.user.display_name || data.user.name,
            avatar_url: data.user.avatar,
          }
        : undefined;

      await setToken(data.access_token, user);

      // Align mobile selected agent with web-selected agent at QR creation time.
      // Load all claimed agents after QR login; user can switch freely on mobile.
      await fetchAgents(data.access_token);

      Alert.alert('Success', '扫码登录成功');
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '扫码登录失败';
      Alert.alert('QR Login Failed', message);
      setScanned(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.root}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Scan QR Login</Text>
        <Text style={styles.subtitle}>在 WTT Web 登录后，打开“移动端扫码登录”并扫描二维码。</Text>

        {!permission ? (
          <View style={styles.centerCard}>
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.centerCard}>
            <Text style={styles.helper}>需要相机权限才能扫码登录</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={
                scanned || busy
                  ? undefined
                  : ({ data }) => {
                      setScanned(true);
                      void submitPayload(data);
                    }
              }
            />
          </View>
        )}

        <Text style={styles.manualLabel}>Or paste QR payload / link</Text>
        <TextInput
          style={styles.input}
          value={manualPayload}
          onChangeText={setManualPayload}
          placeholder="wtt://mobile-login?sid=...&nonce=..."
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.secondaryBtn, (busy || !scanned) && styles.disabledBtn]}
            onPress={() => setScanned(false)}
            disabled={busy || !scanned}
          >
            <Text style={styles.secondaryText}>Scan Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, (busy || !manualPayload.trim()) && styles.disabledBtn]}
            onPress={() => void submitPayload(manualPayload)}
            disabled={busy || !manualPayload.trim()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EFEAE2',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 14,
  },
  centerCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  helper: {
    color: '#6B7280',
    marginBottom: 10,
  },
  cameraWrap: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  camera: {
    width: '100%',
    aspectRatio: 1,
  },
  manualLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 12,
    color: '#6B7280',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 13,
  },
  row: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryText: {
    color: '#374151',
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.6,
  },
});
