import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
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

const { width: SCREEN_W } = Dimensions.get('window');
const VIEWFINDER_SIZE = SCREEN_W * 0.65;
const AUTO_RETRY_MS = 2500;

type ScanStatus = 'scanning' | 'processing' | 'success' | 'error';

function parseMobileLoginPayload(raw: string): { sid: string; nonce: string } | null {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    const json = JSON.parse(text) as { sid?: string; nonce?: string };
    if (json?.sid && json?.nonce) return { sid: String(json.sid), nonce: String(json.nonce) };
  } catch { /* not JSON */ }

  try {
    const url = new URL(text);
    const sid = url.searchParams.get('sid');
    const nonce = url.searchParams.get('nonce');
    if (sid && nonce) return { sid, nonce };
  } catch { /* not a URL */ }

  const sidMatch = text.match(/[?&]sid=([^&#]+)/i);
  const nonceMatch = text.match(/[?&]nonce=([^&#]+)/i);
  if (sidMatch?.[1] && nonceMatch?.[1]) {
    return { sid: decodeURIComponent(sidMatch[1]), nonce: decodeURIComponent(nonceMatch[1]) };
  }
  return null;
}

function friendlyError(msg: string): string {
  if (msg.includes('expired') || msg.includes('410')) return '二维码已过期，请在 Web 端刷新后重新扫描';
  if (msg.includes('nonce') || msg.includes('401')) return '二维码验证失败，请刷新后重试';
  if (msg.includes('not found') || msg.includes('404')) return '登录会话不存在，请重新生成二维码';
  if (msg.includes('consumed') || msg.includes('409')) return '此二维码已使用，请生成新的';
  return msg || '扫码登录失败，请重试';
}

export default function QrLoginScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<ScanStatus>('scanning');
  const [statusText, setStatusText] = useState('将摄像头对准 WTT Web 上的二维码');
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setToken = useAuthStore((s) => s.setToken);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const hydrateAgents = useAgentsStore((s) => s.hydrateAgents);
  const appVersion = useMemo(() => String(Constants.expoConfig?.version || 'unknown'), []);

  // Animated scan line
  const scanAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  const resetToScanning = useCallback(() => {
    setStatus('scanning');
    setStatusText('将摄像头对准 WTT Web 上的二维码');
  }, []);

  const scheduleRetry = useCallback(() => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(resetToScanning, AUTO_RETRY_MS);
  }, [resetToScanning]);

  useEffect(() => {
    return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, []);

  const handleBarcode = useCallback(async (data: string) => {
    if (status !== 'scanning') return;

    const parsed = parseMobileLoginPayload(data);
    if (!parsed) {
      setStatus('error');
      setStatusText('无法识别此二维码');
      scheduleRetry();
      return;
    }

    setStatus('processing');
    setStatusText('正在验证...');

    try {
      const client = new WTTApiClient(WTT_API_URL);
      const result = await client.approveMobileLoginSession(parsed.sid, parsed.nonce, {
        platform: Platform.OS,
        app_version: appVersion,
        device_name: `${Platform.OS}-mobile`,
      });

      if (!result.access_token) throw new Error('Missing access token');

      const user = result.user
        ? {
            id: result.user.id || '',
            username: result.user.display_name || result.user.name || result.user.email || 'user',
            email: result.user.email || '',
            display_name: result.user.display_name || result.user.name,
            avatar_url: result.user.avatar,
          }
        : undefined;

      await setToken(result.access_token, user);

      if (Array.isArray(result.claimed_agents) && result.claimed_agents.length > 0) {
        await hydrateAgents(result.claimed_agents);
      } else {
        await fetchAgents(result.access_token);
      }

      setStatus('success');
      setStatusText('登录成功');
      setTimeout(() => router.replace('/(tabs)'), 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setStatus('error');
      setStatusText(friendlyError(msg));
      scheduleRetry();
    }
  }, [status, appVersion, setToken, hydrateAgents, fetchAgents, scheduleRetry]);

  const isActive = status === 'scanning';

  const scanLineTranslate = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, VIEWFINDER_SIZE - 4],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Camera fills entire screen */}
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={isActive ? ({ data }) => { void handleBarcode(data); } : undefined}
        />
      ) : null}

      {/* Dark overlay with transparent viewfinder cutout */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.overlayFill} />
        <View style={styles.middleRow}>
          <View style={styles.overlayFill} />
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {isActive && (
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]}
              />
            )}
            {status === 'processing' && (
              <View style={styles.statusOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
            {status === 'success' && (
              <View style={styles.statusOverlay}>
                <Text style={styles.successIcon}>✓</Text>
              </View>
            )}
            {status === 'error' && (
              <View style={styles.statusOverlay}>
                <Text style={styles.errorIcon}>!</Text>
              </View>
            )}
          </View>
          <View style={styles.overlayFill} />
        </View>
        <View style={styles.overlayFill} />
      </View>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Scan QR Code</Text>
        <View style={styles.backBtn} />
      </SafeAreaView>

      {/* Bottom status */}
      <SafeAreaView style={styles.bottomArea}>
        <Text style={[
          styles.statusLabel,
          status === 'success' && styles.statusSuccess,
          status === 'error' && styles.statusError,
        ]}>
          {statusText}
        </Text>
        <Text style={styles.hint}>在 WTT Web → Settings → Binding 中生成二维码</Text>

        {permission && !permission.granted && (
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>允许使用摄像头</Text>
          </TouchableOpacity>
        )}

        {status === 'error' && (
          <TouchableOpacity style={styles.retryBtn} onPress={resetToScanning}>
            <Text style={styles.retryText}>立即重试</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlayFill: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  middleRow: {
    flexDirection: 'row',
    height: VIEWFINDER_SIZE,
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#818CF8',
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: '#818CF8',
    borderRadius: 1,
    opacity: 0.8,
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  successIcon: {
    fontSize: 48,
    color: '#4ADE80',
    fontWeight: '700',
  },
  errorIcon: {
    fontSize: 44,
    color: '#FB923C',
    fontWeight: '800',
    backgroundColor: 'rgba(251,146,60,0.2)',
    width: 56,
    height: 56,
    borderRadius: 28,
    textAlign: 'center',
    lineHeight: 56,
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 32) + 8 : 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 70,
  },
  backText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  topTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  statusLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusSuccess: { color: '#4ADE80' },
  statusError: { color: '#FB923C' },
  hint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  permBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  permBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  retryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
