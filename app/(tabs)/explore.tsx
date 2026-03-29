import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useTopicsStore } from '@/stores/topics';
import { haptic } from '@/lib/haptics';
import type { Topic } from '@/lib/api/wtt-client';

const TOPIC_TYPES = ['all', 'broadcast', 'discussion', 'p2p', 'collaborative'] as const;
type TopicTypeFilter = (typeof TOPIC_TYPES)[number];

const TYPE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  broadcast: { bg: '#DBEAFE', text: '#1D4ED8' },
  discussion: { bg: '#DCFCE7', text: '#15803D' },
  p2p: { bg: '#F3E8FF', text: '#7E22CE' },
  collaborative: { bg: '#FEF3C7', text: '#B45309' },
};

const TYPE_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  broadcast: { bg: 'bg-blue-100', text: 'text-blue-700' },
  discussion: { bg: 'bg-green-100', text: 'text-green-700' },
  p2p: { bg: 'bg-purple-100', text: 'text-purple-700' },
  collaborative: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

export default function ExploreScreen() {
  const token = useAuthStore((s) => s.token);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);

  const {
    topics,
    searchResults,
    subscribedTopics,
    isLoading,
    isSearching,
    fetchTopics,
    searchTopics,
    clearSearch,
    fetchSubscribedTopics,
    joinTopic,
    leaveTopic,
  } = useTopicsStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<TopicTypeFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [joiningTopicId, setJoiningTopicId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial data load
  useEffect(() => {
    if (token) {
      fetchTopics(token);
      if (selectedAgentId) fetchSubscribedTopics(token, selectedAgentId);
    }
  }, [token, selectedAgentId]);

  // Debounced search
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim()) {
        clearSearch();
        return;
      }
      debounceRef.current = setTimeout(() => {
        if (token) searchTopics(token, text.trim());
      }, 300);
    },
    [token, searchTopics, clearSearch],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    clearSearch();
  }, [clearSearch]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    await fetchTopics(token);
    if (selectedAgentId) await fetchSubscribedTopics(token, selectedAgentId);
    setRefreshing(false);
  }, [token, selectedAgentId, fetchTopics, fetchSubscribedTopics]);

  // Subscribe / unsubscribe
  const handleToggleSubscription = useCallback(
    async (topic: Topic) => {
      if (!token || !selectedAgentId) {
        Alert.alert('Error', 'Please select an agent first.');
        return;
      }

      if (topic.type === 'p2p') {
        Alert.alert(
          'P2P fixed membership',
          'P2P topics are fixed to two agents. Use P2P request flow instead.',
        );
        return;
      }

      setJoiningTopicId(topic.id);
      try {
        const isSubscribed = subscribedTopics.some((t) => t.id === topic.id);
        if (isSubscribed) {
          await leaveTopic(token, topic.id, selectedAgentId);
        } else {
          await joinTopic(token, topic.id, selectedAgentId);
        }
        haptic.success();
      } catch (err: unknown) {
        haptic.error();
        const message = err instanceof Error ? err.message : 'Operation failed';
        Alert.alert('Error', message);
      } finally {
        setJoiningTopicId(null);
      }
    },
    [token, selectedAgentId, subscribedTopics, joinTopic, leaveTopic],
  );

  // Subscribed topic IDs set for fast lookup
  const subscribedIds = useMemo(
    () => new Set(subscribedTopics.map((t) => t.id)),
    [subscribedTopics],
  );

  // Filtered list
  const displayedTopics = useMemo(() => {
    const source = searchResults ?? topics;
    if (activeFilter === 'all') return source;
    return source.filter((t) => t.type === activeFilter);
  }, [topics, searchResults, activeFilter]);

  const AVATAR_ICONS: Record<string, string> = {
    broadcast: '📡',
    discussion: '💬',
    p2p: '🔒',
    collaborative: '🤝',
  };

  const renderTopicRow = useCallback(
    ({ item }: { item: Topic }) => {
      const badgeColor = TYPE_BADGE_COLORS[item.type] || TYPE_BADGE_COLORS.discussion;
      const isSubscribed = subscribedIds.has(item.id);
      const isJoining = joiningTopicId === item.id;
      const canToggleSubscribe = item.type !== 'p2p';
      const emoji = AVATAR_ICONS[item.type] || '💬';

      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() =>
            router.push({ pathname: '/chat/[id]', params: { id: item.id, name: item.name } })
          }
          activeOpacity={0.7}
        >
          {/* Avatar */}
          <View style={[styles.rowAvatar, { backgroundColor: badgeColor.bg }]}>
            <Text style={styles.rowAvatarEmoji}>{emoji}</Text>
          </View>

          {/* Text column */}
          <View style={styles.rowTextCol}>
            <View style={styles.rowTitleRow}>
              <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.rowTypeBadge, { backgroundColor: badgeColor.bg }]}>
                <Text style={[styles.rowTypeText, { color: badgeColor.text }]}>{item.type}</Text>
              </View>
            </View>
            {!!item.description && (
              <Text style={styles.rowDesc} numberOfLines={1}>{item.description}</Text>
            )}
            <View style={styles.rowMeta}>
              <Ionicons name="people-outline" size={12} color="#9CA3AF" />
              <Text style={styles.rowMembers}>{item.member_count ?? 0}</Text>
              <Text style={styles.rowJoinMethod}>
                {item.join_method === 'open' ? '• Open' : '• Invite'}
              </Text>
            </View>
          </View>

          {/* Subscribe / P2P pill */}
          {canToggleSubscribe ? (
            <TouchableOpacity
              style={[styles.rowSubBtn, isSubscribed ? styles.rowSubbed : styles.rowNotSubbed]}
              onPress={() => handleToggleSubscription(item)}
              disabled={isJoining}
              activeOpacity={0.7}
            >
              {isJoining ? (
                <ActivityIndicator size="small" color={isSubscribed ? '#6B7280' : '#fff'} />
              ) : (
                <Text style={isSubscribed ? styles.rowSubbedText : styles.rowNotSubbedText}>
                  {isSubscribed ? '✓' : 'Join'}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.p2pFixedPill}>
              <Text style={styles.p2pFixedText}>P2P</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [subscribedIds, joiningTopicId, handleToggleSubscription],
  );

  const renderEmptyState = useCallback(() => {
    if (isLoading) return null;
    return (
      <View className="flex-1 items-center justify-center mt-20" style={styles.empty}>
        <Ionicons name="search-outline" size={48} color="#9CA3AF" />
        <Text className="text-gray-400 font-inter mt-4 text-base" style={styles.emptyTitle}>
          No topics found
        </Text>
        <Text className="text-gray-400 font-inter text-sm mt-1" style={styles.emptySubtitle}>
          {searchQuery ? 'Try a different search term' : 'Pull down to refresh'}
        </Text>
      </View>
    );
  }, [isLoading, searchQuery]);

  return (
    <View className="flex-1 bg-gray-50 dark:bg-zinc-900" style={styles.root}>
      {/* Search bar */}
      <View
        className="flex-row items-center bg-white dark:bg-zinc-800 mx-4 mt-3 mb-2 px-3 py-2 rounded-xl"
        style={styles.searchBar}
      >
        <Ionicons name="search-outline" size={18} color="#9CA3AF" />
        <TextInput
          className="flex-1 ml-2 text-sm text-gray-900 dark:text-gray-100 font-inter"
          style={styles.searchInput}
          placeholder="Search topics..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isSearching && <ActivityIndicator size="small" color="#6366F1" />}
        {!!searchQuery && !isSearching && (
          <TouchableOpacity
            onPress={handleClearSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Type filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        className="mb-1"
        style={styles.chipScroll}
      >
        {TOPIC_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            className={`mr-2 rounded-full px-4 py-1.5 ${
              activeFilter === type ? 'bg-indigo-500' : 'bg-gray-100 dark:bg-zinc-800'
            }`}
            style={[styles.chip, activeFilter === type ? styles.chipActive : styles.chipInactive]}
            onPress={() => setActiveFilter(type)}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-inter capitalize ${
                activeFilter === type ? 'text-white' : 'text-gray-600 dark:text-gray-400'
              }`}
              style={activeFilter === type ? styles.chipTextActive : styles.chipTextInactive}
            >
              {type === 'all' ? 'All' : type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loading state */}
      {isLoading && topics.length === 0 && (
        <View className="flex-1 items-center justify-center" style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      )}

      {/* Topics list */}
      {(!isLoading || topics.length > 0) && (
        <FlatList
          data={displayedTopics}
          keyExtractor={(item) => item.id}
          renderItem={renderTopicRow}
          ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366F1" />
          }
        />
      )}

      {/* FAB — Create Topic */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-indigo-500 items-center justify-center"
        style={styles.fab}
        onPress={() => router.push('/topic/create')}
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
    backgroundColor: '#EFEAE2',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111827',
  },
  chipScroll: {
    marginBottom: 4,
  },
  chip: {
    marginRight: 8,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#6366F1',
  },
  chipInactive: {
    backgroundColor: '#F3F4F6',
  },
  chipTextActive: {
    color: '#fff',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  chipTextInactive: {
    color: '#4B5563',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowAvatarEmoji: {
    fontSize: 22,
  },
  rowTextCol: {
    flex: 1,
    marginRight: 8,
  },
  rowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 6,
  },
  rowTypeBadge: {
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  rowTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowMembers: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 3,
    marginRight: 6,
  },
  rowJoinMethod: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  rowSubBtn: {
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 44,
    alignItems: 'center',
  },
  rowSubbed: {
    backgroundColor: '#E5E7EB',
  },
  rowNotSubbed: {
    backgroundColor: '#6366F1',
  },
  rowSubbedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  rowNotSubbedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  rowDivider: {
    height: 0.5,
    backgroundColor: '#E5E7EB',
    marginLeft: 76,
  },
  p2pFixedPill: {
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EDE9FE',
  },
  p2pFixedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5B21B6',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
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
    bottom: 86,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
