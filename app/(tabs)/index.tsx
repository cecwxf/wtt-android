import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useWebSocketStore } from '@/stores/websocket';
import { WTT_API_URL } from '@/lib/api/base-url';
import { formatTimeAgo } from '@/lib/time';
import type { Topic } from '@/lib/api/wtt-client';

interface TopicWithPreview extends Topic {
  last_message_content?: string;
  last_message_at?: string;
  unread_count?: number;
}

export default function ChatsScreen() {
  const token = useAuthStore((s) => s.token);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const loadSelectedAgent = useAgentsStore((s) => s.loadSelectedAgent);
  const wsState = useWebSocketStore((s) => s.wsState);

  const [topics, setTopics] = useState<TopicWithPreview[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTopics = useCallback(async () => {
    if (!token || !selectedAgentId) return;
    try {
      const res = await fetch(
        `${WTT_API_URL}/api/agents/${selectedAgentId}/subscribed-topics`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const list: TopicWithPreview[] = (data.topics || data || []).map(
          (t: TopicWithPreview) => ({
            ...t,
            last_message_at: t.last_message_at || t.created_at,
          }),
        );
        list.sort((a, b) => {
          const ta = new Date(a.last_message_at || a.created_at).getTime();
          const tb = new Date(b.last_message_at || b.created_at).getTime();
          return tb - ta;
        });
        setTopics(list);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token, selectedAgentId]);

  useEffect(() => {
    if (token) {
      loadSelectedAgent();
      fetchAgents(token);
    }
  }, [token, fetchAgents, loadSelectedAgent]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // Auto-refresh every 15s
  useEffect(() => {
    if (!token || !selectedAgentId) return;
    const interval = setInterval(fetchTopics, 15000);
    return () => clearInterval(interval);
  }, [token, selectedAgentId, fetchTopics]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTopics();
    setRefreshing(false);
  };

  const selectedAgent = agents.find((a) => a.agent_id === selectedAgentId);

  const wsColor =
    wsState === 'connected'
      ? '#22C55E'
      : wsState === 'connecting'
        ? '#EAB308'
        : '#D1D5DB';

  const renderTopic = ({ item }: { item: TopicWithPreview }) => (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 border-b border-gray-50"
      style={styles.topicRow}
      onPress={() =>
        router.push({
          pathname: '/chat/[id]',
          params: { id: item.id, name: item.name },
        })
      }
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 rounded-full bg-indigo-50 items-center justify-center mr-3" style={styles.avatar}>
        <Ionicons
          name={item.type === 'p2p' ? 'person' : 'chatbubbles'}
          size={20}
          color="#6366F1"
        />
      </View>
      <View className="flex-1 mr-2" style={styles.textContainer}>
        <View className="flex-row items-center" style={styles.nameRow}>
          <Text className="text-base font-semibold text-gray-900 flex-1" style={styles.topicName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-xs text-gray-400 ml-2" style={styles.time}>
            {formatTimeAgo(item.last_message_at || item.created_at)}
          </Text>
        </View>
        <Text className="text-sm text-gray-500 mt-0.5" style={styles.description} numberOfLines={1}>
          {item.last_message_content || item.description || item.type}
        </Text>
      </View>
      {(item.unread_count ?? 0) > 0 && (
        <View className="bg-indigo-500 rounded-full min-w-[20px] h-5 px-1.5 items-center justify-center" style={styles.badge}>
          <Text className="text-white text-xs font-semibold" style={styles.badgeText}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50" style={styles.loading}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={styles.root}>
      {/* Header bar with agent name and connection status */}
      <View className="flex-row items-center px-4 py-2 bg-white border-b border-gray-100" style={styles.header}>
        <View className="flex-1" style={styles.headerLeft}>
          <Text className="text-lg font-bold text-gray-900" style={styles.headerTitle}>
            {selectedAgent?.display_name || 'WTT'}
          </Text>
        </View>
        <View className="flex-row items-center" style={styles.statusRow}>
          <View
            className={`w-2 h-2 rounded-full mr-1.5 ${
              wsState === 'connected'
                ? 'bg-green-500'
                : wsState === 'connecting'
                  ? 'bg-yellow-500'
                  : 'bg-gray-300'
            }`}
            style={[styles.statusDot, { backgroundColor: wsColor }]}
          />
          <Text className="text-xs text-gray-400" style={styles.statusText}>
            {wsState === 'connected' ? 'Online' : wsState === 'connecting' ? 'Connecting...' : 'Offline'}
          </Text>
        </View>
      </View>

      <FlatList
        data={topics}
        keyExtractor={(item) => item.id}
        renderItem={renderTopic}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
        contentContainerStyle={topics.length === 0 ? { flex: 1 } : undefined}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center" style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color="#94A3B8" />
            <Text className="text-gray-400 mt-4 text-base" style={styles.emptyTitle}>No conversations yet</Text>
            <Text className="text-gray-400 text-sm mt-1" style={styles.emptySubtitle}>
              Explore topics or claim an agent to start
            </Text>
          </View>
        }
      />

      {/* FAB — Claim Agent */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-500 items-center justify-center"
        style={styles.fab}
        onPress={() => router.push('/agent/claim')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
