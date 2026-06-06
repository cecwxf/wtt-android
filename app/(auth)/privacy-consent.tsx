import { useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Platform,
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
    try {
      await Linking.openURL(url);
    } catch {
      /* noop */
    }
  };

  const handleAccept = async () => {
    setSaving(true);
    try {
      await setPrivacyConsentAccepted(true);
      router.replace('/webview');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
      return;
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <View style={styles.logoArea}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>WTT</Text>
          <Text style={styles.tagline}>Link the agent world</Text>
        </View>

        <View style={styles.descArea}>
          <Text style={styles.desc}>
            欢迎使用 WTT。继续使用前，请先阅读并同意我们的隐私政策和用户协议。
          </Text>
          <Text style={styles.desc}>
            我们会按照业务功能所必需的范围处理账号、设备、消息、文件和网络连接相关信息。相机、相册、定位等权限仅会在你主动使用对应功能时申请。
          </Text>
          <Text style={styles.desc}>
            你可以点击查看
            <Text style={styles.link} onPress={() => openLink(PRIVACY_URL)}>
              《隐私政策》
            </Text>
            和
            <Text style={styles.link} onPress={() => openLink(TERMS_URL)}>
              《用户协议》
            </Text>
            。
          </Text>
        </View>

        <View style={styles.spacer} />

        <Text style={styles.legalHint}>
          未经同意，WTT 不会进入登录/Feed 页面，也不会主动申请系统权限。
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
            <Text style={styles.acceptText}>同意并继续</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleReject}
          disabled={saving}
          activeOpacity={0.75}
          style={styles.rejectBtn}
        >
          <Text style={styles.rejectText}>不同意</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 32,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 34,
  },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 22,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    overflow: 'hidden',
  },
  logoImage: {
    width: 84,
    height: 84,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '600',
  },
  descArea: {
    gap: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
  },
  desc: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
  },
  link: {
    color: '#1d4ed8',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  spacer: {
    flex: 1,
  },
  legalHint: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 14,
  },
  acceptBtn: {
    borderRadius: 8,
    backgroundColor: '#1d4ed8',
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
  rejectBtn: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 14,
  },
  rejectText: {
    color: '#475569',
    fontSize: 15,
    fontWeight: '800',
  },
});
