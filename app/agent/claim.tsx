import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';

export default function ClaimAgentScreen() {
  const [agentId, setAgentId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const token = useAuthStore((s) => s.token);
  const claimAgent = useAgentsStore((s) => s.claimAgent);

  const handleClaim = async () => {
    if (!agentId.trim() || !inviteCode.trim()) {
      Alert.alert('Error', 'Please fill in both fields');
      return;
    }
    if (!token) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }
    setLoading(true);
    try {
      await claimAgent(token, agentId.trim(), inviteCode.trim());
      Alert.alert('Success', 'Agent claimed successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Claim failed';
      Alert.alert('Claim Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background-light dark:bg-background-dark"
      style={s.root}
    >
      <View className="flex-1 justify-center px-8" style={s.inner}>
        <View className="items-center mb-10" style={s.header}>
          <View className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900 items-center justify-center mb-4" style={s.iconCircle}>
            <Ionicons name="hardware-chip-outline" size={32} color="#6366F1" />
          </View>
          <Text className="text-2xl font-inter-bold text-gray-900 dark:text-gray-100" style={s.title}>
            Claim Agent
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 font-inter mt-2 text-center px-4" style={s.subtitle}>
            Enter your agent ID and invite code to bind an AI agent to your account
          </Text>
        </View>

        <Text className="text-sm font-inter text-gray-600 dark:text-gray-400 mb-1 ml-1" style={s.label}>
          Agent ID
        </Text>
        <TextInput
          className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-gray-100 mb-4 font-inter"
          style={s.input}
          placeholder="e.g. agent-abc123"
          placeholderTextColor="#9CA3AF"
          value={agentId}
          onChangeText={setAgentId}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text className="text-sm font-inter text-gray-600 dark:text-gray-400 mb-1 ml-1" style={s.label}>
          Invite Code
        </Text>
        <TextInput
          className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-base text-gray-900 dark:text-gray-100 mb-6 font-inter"
          style={s.inputLast}
          placeholder="Paste invite code"
          placeholderTextColor="#9CA3AF"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          className="bg-primary rounded-xl py-4 items-center mb-4"
          style={s.claimBtn}
          onPress={handleClaim}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-inter-semibold" style={s.claimText}>
              Claim Agent
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="py-3 items-center"
          style={s.cancelBtn}
          onPress={() => router.back()}
        >
          <Text className="text-gray-500 font-inter text-sm" style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  header: { alignItems: 'center', marginBottom: 40 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 16 },
  label: { fontSize: 14, color: '#6B7280', marginBottom: 4, marginLeft: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827', marginBottom: 16 },
  inputLast: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827', marginBottom: 24 },
  claimBtn: { backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 16 },
  claimText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#6B7280', fontSize: 14 },
});
