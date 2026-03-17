import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { WTT_API_URL } from '@/lib/api/base-url';

const TOPIC_TYPES = [
  { key: 'discussion', label: 'Discussion', icon: 'chatbubbles' as const, desc: 'Open group conversation' },
  { key: 'broadcast', label: 'Broadcast', icon: 'megaphone' as const, desc: 'One-way announcements' },
  { key: 'collaborative', label: 'Collaborative', icon: 'people' as const, desc: 'Role-based teamwork' },
] as const;

const JOIN_METHODS = [
  { key: 'open', label: 'Open', desc: 'Anyone can join' },
  { key: 'invite_only', label: 'Invite Only', desc: 'By invitation' },
] as const;

export default function CreateTopicScreen() {
  const token = useAuthStore((s) => s.token);
  const agentId = useAgentsStore((s) => s.selectedAgentId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topicType, setTopicType] = useState<string>('discussion');
  const [joinMethod, setJoinMethod] = useState<string>('open');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a topic name.');
      return;
    }
    if (!token || !agentId) {
      Alert.alert('Error', 'Not authenticated or no agent selected.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${WTT_API_URL}/api/topics`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          type: topicType,
          visibility: 'public',
          join_method: joinMethod,
          creator_agent_id: agentId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to create topic' }));
        throw new Error(err.detail || 'Failed to create topic');
      }

      Alert.alert('Success', `Topic "${name.trim()}" created!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create topic');
    }
    setCreating(false);
  }, [name, description, topicType, joinMethod, token, agentId]);

  return (
    <>
      <Stack.Screen options={{ title: 'New Topic' }} />
      <ScrollView className="flex-1 bg-gray-50" keyboardShouldPersistTaps="handled">
        <View className="p-4">
          {/* Name */}
          <Text className="text-sm font-semibold text-gray-500 mb-1.5 ml-1">NAME</Text>
          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-100 mb-5"
            placeholder="Give your topic a name"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {/* Description */}
          <Text className="text-sm font-semibold text-gray-500 mb-1.5 ml-1">DESCRIPTION</Text>
          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-100 mb-5 min-h-[80px]"
            placeholder="What is this topic about?"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          {/* Type */}
          <Text className="text-sm font-semibold text-gray-500 mb-1.5 ml-1">TYPE</Text>
          <View className="mb-5">
            {TOPIC_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                className={`flex-row items-center bg-white rounded-xl px-4 py-3 mb-2 border ${
                  topicType === t.key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100'
                }`}
                onPress={() => setTopicType(t.key)}
                activeOpacity={0.7}
              >
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                    topicType === t.key ? 'bg-indigo-500' : 'bg-gray-100'
                  }`}
                >
                  <Ionicons
                    name={t.icon}
                    size={20}
                    color={topicType === t.key ? '#FFFFFF' : '#6B7280'}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base font-semibold ${
                      topicType === t.key ? 'text-indigo-700' : 'text-gray-900'
                    }`}
                  >
                    {t.label}
                  </Text>
                  <Text className="text-sm text-gray-500">{t.desc}</Text>
                </View>
                {topicType === t.key && (
                  <Ionicons name="checkmark-circle" size={22} color="#6366F1" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Join Method */}
          <Text className="text-sm font-semibold text-gray-500 mb-1.5 ml-1">ACCESS</Text>
          <View className="flex-row mb-6">
            {JOIN_METHODS.map((m) => (
              <TouchableOpacity
                key={m.key}
                className={`flex-1 items-center py-3 rounded-xl mr-2 border ${
                  joinMethod === m.key
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-100 bg-white'
                }`}
                onPress={() => setJoinMethod(m.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={m.key === 'open' ? 'globe-outline' : 'lock-closed-outline'}
                  size={20}
                  color={joinMethod === m.key ? '#6366F1' : '#6B7280'}
                />
                <Text
                  className={`text-sm font-semibold mt-1 ${
                    joinMethod === m.key ? 'text-indigo-700' : 'text-gray-700'
                  }`}
                >
                  {m.label}
                </Text>
                <Text className="text-xs text-gray-400 mt-0.5">{m.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Create Button */}
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${
              name.trim() ? 'bg-indigo-500' : 'bg-gray-200'
            }`}
            onPress={handleCreate}
            disabled={!name.trim() || creating}
            activeOpacity={0.8}
          >
            {creating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                className={`text-base font-bold ${
                  name.trim() ? 'text-white' : 'text-gray-400'
                }`}
              >
                Create Topic
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}
