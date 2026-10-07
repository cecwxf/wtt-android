import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18nStore } from '@/stores/i18n';
import { useThemeStore } from '@/stores/theme';

export function NativeFileDownloadCard({ state, onCancel, onShare, onDismiss }: {
  state: { status: 'downloading' | 'ready' | 'sharing' | 'cancelled' | 'error'; filename: string; loaded: number; total: number; shareError?: boolean };
  onCancel: () => void; onShare: () => void; onDismiss: () => void;
}) {
  const en = useI18nStore(value => value.locale) === 'en';
  const dark = useThemeStore(value => value.resolved) === 'dark';
  const insets = useSafeAreaInsets();
  const active = state.status === 'downloading';
  const ready = state.status === 'ready';
  const text = dark ? '#f4f4f5' : '#18181b';
  const percent = state.total ? Math.min(100, Math.round(state.loaded / state.total * 100)) : 0;
  const title = active ? (en ? 'Downloading' : '正在下载') : ready ? (en ? 'Download complete' : '下载完成')
    : state.status === 'sharing' ? (en ? 'Saving / sharing' : '保存或分享中') : state.status === 'cancelled' ? (en ? 'Download cancelled' : '已取消下载') : (en ? 'Download failed' : '下载失败');
  return <View accessibilityLiveRegion="polite" style={[styles.root, { bottom: insets.bottom + 12, backgroundColor: dark ? '#18181b' : '#ffffff', borderColor: dark ? '#3f3f46' : '#d4d4d8' }]}>
    <View style={styles.row}><Text style={[styles.title, { color: text }]}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={active ? (en ? 'Cancel download' : '取消下载') : (en ? 'Dismiss download' : '关闭下载')} disabled={state.status === 'sharing'} onPress={active ? onCancel : onDismiss} hitSlop={10} style={styles.icon}><Ionicons name="close" size={20} color={text} /></Pressable>
    </View>
    <Text numberOfLines={1} style={[styles.filename, { color: dark ? '#a1a1aa' : '#52525b' }]}>{state.filename}</Text>
    {active && <View style={[styles.track, { backgroundColor: dark ? '#3f3f46' : '#e4e4e7' }]}><View style={[styles.fill, { width: `${percent}%` }]} /></View>}
    <View style={styles.row}><Text style={[styles.meta, { color: dark ? '#a1a1aa' : '#71717a' }]}>{active ? `${percent}%` : state.shareError ? (en ? 'Save/share failed. Retry.' : '保存或分享失败，请重试。') : `${(state.loaded / 1024 / 1024).toFixed(1)} MiB`}</Text>
      {ready && <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Save or share file' : '保存或分享文件'} onPress={onShare} style={styles.share}><Ionicons name="share-outline" size={17} color="#059669" /><Text style={styles.shareLabel}>{en ? 'Save / share' : '保存 / 分享'}</Text></Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 12, right: 12, zIndex: 20, borderWidth: 1, borderRadius: 8, padding: 12, elevation: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 14, fontWeight: '600' },
  filename: { fontSize: 12, marginTop: 3, marginBottom: 8 },
  icon: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center' },
  track: { height: 4, overflow: 'hidden', borderRadius: 2, marginBottom: 8 },
  fill: { height: 4, backgroundColor: '#059669' },
  meta: { flex: 1, fontSize: 12 },
  share: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  shareLabel: { fontSize: 12, color: '#059669', fontWeight: '600' },
});
