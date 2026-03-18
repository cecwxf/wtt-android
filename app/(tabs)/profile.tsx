import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useWebSocketStore } from '@/stores/websocket';
import { useThemeStore } from '@/stores/theme';
import { useI18nStore } from '@/stores/i18n';

const THEME_OPTIONS = [
  { value: 'system' as const, label: 'System' },
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' },
];

const LANG_OPTIONS = [
  { value: 'en' as const, label: 'English' },
  { value: 'zh' as const, label: '中文' },
];

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const agents = useAgentsStore((s) => s.agents);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);
  const wsState = useWebSocketStore((s) => s.wsState);
  const themeMode = useThemeStore((s) => s.mode);
  const setTheme = useThemeStore((s) => s.setMode);
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const t = useI18nStore((s) => s.t);

  const handleLogout = async () => {
    Alert.alert(t.auth.signOut, 'Are you sure you want to sign out?', [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.auth.signOut,
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleSelectAgent = async (agentId: string) => {
    if (agentId === selectedAgentId) return;
    await selectAgent(agentId);
  };

  const handleThemePick = () => {
    const buttons = THEME_OPTIONS.map((opt) => ({
      text: opt.label + (opt.value === themeMode ? ' ✓' : ''),
      onPress: () => setTheme(opt.value),
    }));
    buttons.push({ text: t.common.cancel, onPress: async () => {} });
    Alert.alert(t.profile.darkMode, '', buttons);
  };

  const handleLangPick = () => {
    const buttons = LANG_OPTIONS.map((opt) => ({
      text: opt.label + (opt.value === locale ? ' ✓' : ''),
      onPress: () => setLocale(opt.value),
    }));
    buttons.push({ text: t.common.cancel, onPress: async () => {} });
    Alert.alert(t.profile.language, '', buttons);
  };

  const themeModeLabel = THEME_OPTIONS.find((o) => o.value === themeMode)?.label ?? 'System';
  const langLabel = LANG_OPTIONS.find((o) => o.value === locale)?.label ?? 'English';

  const wsColor =
    wsState === 'connected'
      ? '#22C55E'
      : wsState === 'connecting'
        ? '#EAB308'
        : '#D1D5DB';

  return (
    <ScrollView className="flex-1 bg-gray-50" style={styles.root}>
      {/* User Info */}
      <View className="items-center pt-8 pb-6 bg-white border-b border-gray-100" style={styles.userInfo}>
        <View className="w-20 h-20 rounded-full bg-indigo-500 items-center justify-center mb-3" style={styles.avatarCircle}>
          <Text className="text-white text-2xl font-bold" style={styles.avatarText}>
            {(user?.display_name || user?.username || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text className="text-lg font-bold text-gray-900" style={styles.username}>
          {user?.display_name || user?.username || 'User'}
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5" style={styles.email}>
          {user?.email || ''}
        </Text>
        <View className="flex-row items-center mt-2" style={styles.statusRow}>
          <View
            className={`w-2 h-2 rounded-full mr-1.5 ${
              wsState === 'connected' ? 'bg-green-500' : wsState === 'connecting' ? 'bg-yellow-500' : 'bg-gray-300'
            }`}
            style={[styles.statusDot, { backgroundColor: wsColor }]}
          />
          <Text className="text-xs text-gray-400" style={styles.statusText}>
            {wsState === 'connected' ? 'Connected' : wsState === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </Text>
        </View>
      </View>

      {/* Agent Section */}
      <View className="mx-4 mt-4 mb-4" style={styles.section}>
        <Text className="text-sm font-semibold text-gray-500 mb-2 ml-1" style={styles.sectionTitle}>
          {t.profile.agents.toUpperCase()}
        </Text>
        <View className="bg-white rounded-xl overflow-hidden" style={styles.card}>
          {agents.length === 0 ? (
            <View className="px-4 py-3" style={styles.noAgentRow}>
              <Text className="text-gray-400 text-sm" style={styles.noAgentText}>{t.profile.noAgents}</Text>
            </View>
          ) : (
            agents.map((agent, idx) => {
              const isSelected = agent.agent_id === selectedAgentId;
              return (
                <TouchableOpacity
                  key={agent.agent_id}
                  className={`flex-row items-center px-4 py-3 ${
                    idx < agents.length - 1 ? 'border-b border-gray-50' : ''
                  } ${isSelected ? 'bg-indigo-50' : ''}`}
                  style={[
                    styles.settingsRow,
                    idx < agents.length - 1 ? styles.rowBorder : null,
                    isSelected ? styles.agentSelected : null,
                  ]}
                  onPress={() => handleSelectAgent(agent.agent_id)}
                  activeOpacity={0.7}
                >
                  <View
                    className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
                      isSelected ? 'bg-indigo-500' : 'bg-gray-100'
                    }`}
                    style={[styles.agentIcon, isSelected ? styles.agentIconSelected : styles.agentIconDefault]}
                  >
                    <Ionicons
                      name="hardware-chip-outline"
                      size={16}
                      color={isSelected ? '#FFFFFF' : '#6366F1'}
                    />
                  </View>
                  <View className="flex-1" style={styles.agentTextCol}>
                    <Text className="text-base font-medium text-gray-900" style={styles.agentName}>
                      {agent.display_name}
                    </Text>
                    <Text className="text-xs text-gray-400" style={styles.agentId}>
                      {agent.agent_id}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#6366F1" />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <TouchableOpacity
          className="mt-2 bg-indigo-50 rounded-xl py-3 items-center"
          style={styles.claimButton}
          onPress={() => router.push('/agent/claim')}
          activeOpacity={0.7}
        >
          <Text className="text-indigo-600 font-semibold text-sm" style={styles.claimText}>+ Claim Agent</Text>
        </TouchableOpacity>
      </View>

      {/* Settings */}
      <View className="mx-4 mb-4" style={styles.section}>
        <Text className="text-sm font-semibold text-gray-500 mb-2 ml-1" style={styles.sectionTitle}>
          {t.profile.settings.toUpperCase()}
        </Text>
        <View className="bg-white rounded-xl overflow-hidden" style={styles.card}>
          <TouchableOpacity
            className="flex-row items-center px-4 py-3 border-b border-gray-50"
            style={[styles.settingsRow, styles.rowBorder]}
            onPress={handleThemePick}
            activeOpacity={0.7}
          >
            <Ionicons name="moon-outline" size={20} color="#64748B" />
            <Text className="flex-1 ml-3 text-base text-gray-900" style={styles.settingsLabel}>
              {t.profile.darkMode}
            </Text>
            <Text className="text-sm text-gray-400" style={styles.settingsValue}>{themeModeLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center px-4 py-3 border-b border-gray-50"
            style={[styles.settingsRow, styles.rowBorder]}
            onPress={handleLangPick}
            activeOpacity={0.7}
          >
            <Ionicons name="language-outline" size={20} color="#64748B" />
            <Text className="flex-1 ml-3 text-base text-gray-900" style={styles.settingsLabel}>
              {t.profile.language}
            </Text>
            <Text className="text-sm text-gray-400" style={styles.settingsValue}>{langLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center px-4 py-3" style={styles.settingsRow} activeOpacity={0.7}>
            <Ionicons name="information-circle-outline" size={20} color="#64748B" />
            <Text className="flex-1 ml-3 text-base text-gray-900" style={styles.settingsLabel}>
              About
            </Text>
            <Text className="text-sm text-gray-400" style={styles.settingsValue}>v1.0.0</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <View className="mx-4 mb-8" style={styles.logoutSection}>
        <TouchableOpacity
          className="bg-red-50 rounded-xl py-3.5 items-center"
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text className="text-red-500 font-semibold text-base" style={styles.logoutText}>{t.auth.signOut}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  userInfo: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  settingsLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
  },
  settingsValue: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  agentSelected: {
    backgroundColor: '#EEF2FF',
  },
  agentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  agentIconSelected: {
    backgroundColor: '#6366F1',
  },
  agentIconDefault: {
    backgroundColor: '#F3F4F6',
  },
  agentTextCol: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  agentId: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  noAgentRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noAgentText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  claimButton: {
    marginTop: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  claimText: {
    color: '#4F46E5',
    fontWeight: '600',
    fontSize: 14,
  },
  logoutSection: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 16,
  },
});
