import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
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
      <ScrollView className="flex-1 bg-gray-50" style={s.scroll} keyboardShouldPersistTaps="handled">
        <View className="p-4" style={s.content}>
          {/* Name */}
          <Text className="text-sm font-semibold text-gray-500 mb-1.5 ml-1" style={s.sectionLabel}>NAME</Text>
          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-100 mb-5"
            style={s.input}
            placeholder="Give your topic a name"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          {/* Description */}
          <Text className="text-sm font-semibold text-gray-500 mb-1.5 ml-1" style={s.sectionLabel}>DESCRIPTION</Text>
          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-100 mb-5 min-h-[80px]"
            style={s.textArea}
            placeholder="What is this topic about?"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          {/* Type */}
          <Text className="text-sm font-semibold text-gray-500 mb-1.5 ml-1" style={s.sectionLabel}>TYPE</Text>
          <View style={s.typeGroup}>
            {TOPIC_TYPES.map((t) => {
              const active = topicType === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  className={`flex-row items-center bg-white rounded-xl px-4 py-3 mb-2 border ${
                    active ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100'
                  }`}
                  style={[s.typeCard, active ? s.typeCardActive : s.typeCardInactive]}
                  onPress={() => setTopicType(t.key)}
                  activeOpacity={0.7}
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                      active ? 'bg-indigo-500' : 'bg-gray-100'
                    }`}
                    style={[s.typeIcon, active ? s.typeIconActive : s.typeIconInactive]}
                  >
                    <Ionicons name={t.icon} size={20} color={active ? '#FFFFFF' : '#6B7280'} />
                  </View>
                  <View style={s.typeInfo}>
                    <Text
                      className={`text-base font-semibold ${active ? 'text-indigo-700' : 'text-gray-900'}`}
                      style={{ fontSize: 16, fontWeight: '600', color: active ? '#4338CA' : '#111827' }}
                    >
                      {t.label}
                    </Text>
                    <Text className="text-sm text-gray-500" style={{ fontSize: 14, color: '#6B7280' }}>{t.desc}</Text>
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={22} color="#6366F1" />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Join Method */}
          <Text className="text-sm font-semibold text-gray-500 mb-1.5 ml-1" style={s.sectionLabel}>ACCESS</Text>
          <View className="flex-row mb-6" style={s.joinRow}>
            {JOIN_METHODS.map((m) => {
              const active = joinMethod === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  className={`flex-1 items-center py-3 rounded-xl mr-2 border ${
                    active ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white'
                  }`}
                  style={[s.joinCard, active ? s.joinActive : s.joinInactive]}
                  onPress={() => setJoinMethod(m.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={m.key === 'open' ? 'globe-outline' : 'lock-closed-outline'}
                    size={20}
                    color={active ? '#6366F1' : '#6B7280'}
                  />
                  <Text
                    className={`text-sm font-semibold mt-1 ${active ? 'text-indigo-700' : 'text-gray-700'}`}
                    style={{ fontSize: 14, fontWeight: '600', marginTop: 4, color: active ? '#4338CA' : '#374151' }}
                  >
                    {m.label}
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5" style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{m.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Create Button */}
          <TouchableOpacity
            className={`rounded-xl py-4 items-center ${name.trim() ? 'bg-indigo-500' : 'bg-gray-200'}`}
            style={[s.createBtn, name.trim() ? s.createEnabled : s.createDisabled]}
            onPress={handleCreate}
            disabled={!name.trim() || creating}
            activeOpacity={0.8}
          >
            {creating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                className={`text-base font-bold ${name.trim() ? 'text-white' : 'text-gray-400'}`}
                style={{ fontSize: 16, fontWeight: 'bold', color: name.trim() ? '#fff' : '#9CA3AF' }}
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

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginLeft: 4, textTransform: 'uppercase' },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 20 },
  textArea: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 20, minHeight: 80 },
  typeGroup: { marginBottom: 20 },
  typeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8, borderWidth: 1 },
  typeCardActive: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  typeCardInactive: { borderColor: '#F3F4F6' },
  typeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  typeIconActive: { backgroundColor: '#6366F1' },
  typeIconInactive: { backgroundColor: '#F3F4F6' },
  typeInfo: { flex: 1 },
  joinRow: { flexDirection: 'row', marginBottom: 24 },
  joinCard: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, marginRight: 8, borderWidth: 1 },
  joinActive: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  joinInactive: { borderColor: '#F3F4F6', backgroundColor: '#fff' },
  createBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  createEnabled: { backgroundColor: '#6366F1' },
  createDisabled: { backgroundColor: '#E5E7EB' },
});
