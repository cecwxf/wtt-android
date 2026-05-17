import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import type { WebView as WebViewType } from 'react-native-webview';
import { WTT_API_URL } from '@/lib/api/base-url';
import { useI18nStore } from '@/stores/i18n';

type ArenaEntry = {
  key: 'home' | 'tech' | 'education';
  path: string;
  icon: keyof typeof Ionicons.glyphMap;
  zhTitle: string;
  enTitle: string;
  zhDesc: string;
  enDesc: string;
};

const entries: ArenaEntry[] = [
  {
    key: 'home',
    path: '/arena',
    icon: 'trophy-outline',
    zhTitle: 'Arena 题库大厅',
    enTitle: 'Arena Hub',
    zhDesc: '技术面试、教育学科、Agent Chat 和白板讲解入口。',
    enDesc: 'Entry point for interview practice, education boards, Agent Chat, and whiteboards.',
  },
  {
    key: 'tech',
    path: '/arena/sections/technology',
    icon: 'hardware-chip-outline',
    zhTitle: '技术面试',
    enTitle: 'Interview',
    zhDesc: '系统设计、AI Infra、算法、OS/DB/Network 等训练板块。',
    enDesc: 'System design, AI infra, algorithms, OS/DB/network practice tracks.',
  },
  {
    key: 'education',
    path: '/arena/sections/education',
    icon: 'school-outline',
    zhTitle: '教育板块',
    enTitle: 'Education',
    zhDesc: '小学、初中、高中学科训练，支持白板推导和错题追问。',
    enDesc: 'Primary, middle, and high-school boards with whiteboard reasoning and follow-up.',
  },
];

function absoluteUrl(path: string) {
  return `${WTT_API_URL}${path}`;
}

export default function ArenaScreen() {
  const locale = useI18nStore((s) => s.locale);
  const zh = locale === 'zh';
  const webRef = useRef<WebViewType>(null);
  const [activeKey, setActiveKey] = useState<ArenaEntry['key']>('home');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const activeEntry = useMemo(
    () => entries.find((entry) => entry.key === activeKey) || entries[0],
    [activeKey],
  );
  const activeUrl = absoluteUrl(activeEntry.path);

  const openExternal = async () => {
    const canOpen = await Linking.canOpenURL(activeUrl);
    if (!canOpen) {
      Alert.alert(zh ? '无法打开链接' : 'Cannot open link', activeUrl);
      return;
    }
    await Linking.openURL(activeUrl);
  };

  const reload = () => {
    setLoadError('');
    setLoading(true);
    webRef.current?.reload();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.logo}>
            <Ionicons name="school-outline" size={20} color="#0F766E" />
          </View>
          <View style={styles.titleText}>
            <Text style={styles.eyebrow}>WTT Arena</Text>
            <Text style={styles.title}>
              {zh ? '技术面试与教育训练' : 'Interview and Education'}
            </Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={openExternal} activeOpacity={0.75}>
            <Ionicons name="open-outline" size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          {zh
            ? '在手机上进入 Arena 页面，使用 Agent Coach、白板讲解和阶段化训练。'
            : 'Open Arena on mobile with Agent Coach, whiteboard explanations, and staged practice.'}
        </Text>

        <View style={styles.entryGrid}>
          {entries.map((entry) => {
            const selected = entry.key === activeKey;
            return (
              <TouchableOpacity
                key={entry.key}
                style={[styles.entryCard, selected ? styles.entryCardActive : null]}
                onPress={() => {
                  setActiveKey(entry.key);
                  setLoadError('');
                  setLoading(true);
                }}
                activeOpacity={0.78}
              >
                <Ionicons
                  name={entry.icon}
                  size={18}
                  color={selected ? '#0F766E' : '#64748B'}
                  style={styles.entryIcon}
                />
                <Text style={[styles.entryTitle, selected ? styles.entryTitleActive : null]}>
                  {zh ? entry.zhTitle : entry.enTitle}
                </Text>
                <Text style={styles.entryDesc} numberOfLines={2}>
                  {zh ? entry.zhDesc : entry.enDesc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.webShell}>
        <View style={styles.webTopBar}>
          <Text style={styles.webTitle} numberOfLines={1}>
            {zh ? activeEntry.zhTitle : activeEntry.enTitle}
          </Text>
          <View style={styles.webActions}>
            <TouchableOpacity style={styles.smallButton} onPress={reload} activeOpacity={0.75}>
              <Ionicons name="refresh-outline" size={15} color="#0F172A" />
              <Text style={styles.smallButtonText}>{zh ? '刷新' : 'Reload'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.webBody}>
          <WebView
            ref={webRef}
            source={{ uri: activeUrl }}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            pullToRefreshEnabled
            allowsBackForwardNavigationGestures
            onLoadStart={() => {
              setLoading(true);
              setLoadError('');
            }}
            onLoadEnd={() => setLoading(false)}
            onError={(event) => {
              setLoading(false);
              setLoadError(event.nativeEvent.description || 'Failed to load Arena');
            }}
            style={styles.webView}
          />
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color="#0F766E" />
              <Text style={styles.loadingText}>
                {zh ? '正在加载 Arena...' : 'Loading Arena...'}
              </Text>
            </View>
          )}
          {!!loadError && (
            <View style={styles.errorOverlay}>
              <Ionicons name="warning-outline" size={24} color="#B45309" />
              <Text style={styles.errorTitle}>
                {zh ? 'Arena 加载失败' : 'Arena failed to load'}
              </Text>
              <Text style={styles.errorText}>{loadError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={reload} activeOpacity={0.78}>
                <Text style={styles.retryButtonText}>{zh ? '重试' : 'Retry'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingBottom: 76,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#CCFBF1',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CCFBF1',
    marginRight: 12,
  },
  titleText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#0F766E',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
  },
  entryGrid: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  entryCard: {
    flex: 1,
    minHeight: 94,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  entryCardActive: {
    borderColor: '#14B8A6',
    backgroundColor: '#F0FDFA',
  },
  entryIcon: {
    marginBottom: 6,
  },
  entryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  entryTitleActive: {
    color: '#0F766E',
  },
  entryDesc: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    color: '#64748B',
  },
  webShell: {
    flex: 1,
    margin: 12,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  webTopBar: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  webTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  webActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  webBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,250,252,0.86)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFBEB',
  },
  errorTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
  },
  errorText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: '#B45309',
  },
  retryButton: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: '#0F766E',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
