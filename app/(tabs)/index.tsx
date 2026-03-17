import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { WTT_API_URL } from '@/lib/api/base-url';
import { formatTimeAgo } from '@/lib/time';
import type { Topic } from '@/lib/api/wtt-client';

export default function ChatsScreen() {
  const token = useAuthStore((s) => s.token);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const loadSelectedAgent = useAgentsStore((s) => s.loadSelectedAgent);

  const [topics, setTopics] = useState<Topic[]>([]);
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
        setTopics(data.topics || data || []);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTopics();
    setRefreshing(false);
  };

  const renderTopic = ({ item }: { item: Topic }) => (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-zinc-800"
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: item.id, name: item.name } })}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900 items-center justify-center mr-3">
        <Ionicons
          name={item.type === 'p2p' ? 'person' : 'chatbubbles'}
          size={20}
          color="#6366F1"
        />
      </View>
      <View className="flex-1">
        <Text
          className="text-base font-inter-semibold text-gray-900 dark:text-gray-100"
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          className="text-sm text-gray-500 dark:text-gray-400 font-inter mt-0.5"
          numberOfLines={1}
        >
          {item.description || item.type}
        </Text>
      </View>
      <Text className="text-xs text-gray-400 dark:text-gray-500 font-inter">
        {formatTimeAgo(item.created_at)}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <FlatList
        data={topics}
        keyExtractor={(item) => item.id}
        renderItem={renderTopic}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <Ionicons name="chatbubbles-outline" size={48} color="#94A3B8" />
            <Text className="text-gray-400 font-inter mt-4 text-base">No conversations yet</Text>
            <Text className="text-gray-400 font-inter text-sm mt-1">
              Join a topic or claim an agent to start
            </Text>
          </View>
        }
      />

      {/* FAB — Claim Agent */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        onPress={() => router.push('/agent/claim')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}
