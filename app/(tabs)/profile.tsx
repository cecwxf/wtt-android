import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useWebSocketStore } from '@/stores/websocket';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const agents = useAgentsStore((s) => s.agents);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const selectAgent = useAgentsStore((s) => s.selectAgent);
  const wsState = useWebSocketStore((s) => s.wsState);

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
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

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* User Info */}
      <View className="items-center pt-8 pb-6 bg-white border-b border-gray-100">
        <View className="w-20 h-20 rounded-full bg-indigo-500 items-center justify-center mb-3">
          <Text className="text-white text-2xl font-bold">
            {(user?.display_name || user?.username || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text className="text-lg font-bold text-gray-900">
          {user?.display_name || user?.username || 'User'}
        </Text>
        <Text className="text-sm text-gray-500 mt-0.5">
          {user?.email || ''}
        </Text>
        {/* Connection status */}
        <View className="flex-row items-center mt-2">
          <View
            className={`w-2 h-2 rounded-full mr-1.5 ${
              wsState === 'connected' ? 'bg-green-500' : wsState === 'connecting' ? 'bg-yellow-500' : 'bg-gray-300'
            }`}
          />
          <Text className="text-xs text-gray-400">
            {wsState === 'connected' ? 'Connected' : wsState === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </Text>
        </View>
      </View>

      {/* Agent Section */}
      <View className="mx-4 mt-4 mb-4">
        <Text className="text-sm font-semibold text-gray-500 mb-2 ml-1">
          AGENTS
        </Text>
        <View className="bg-white rounded-xl overflow-hidden">
          {agents.length === 0 ? (
            <View className="px-4 py-3">
              <Text className="text-gray-400 text-sm">No agents claimed</Text>
            </View>
          ) : (
            agents.map((agent, idx) => (
              <TouchableOpacity
                key={agent.agent_id}
                className={`flex-row items-center px-4 py-3 ${
                  idx < agents.length - 1 ? 'border-b border-gray-50' : ''
                } ${agent.agent_id === selectedAgentId ? 'bg-indigo-50' : ''}`}
                onPress={() => handleSelectAgent(agent.agent_id)}
                activeOpacity={0.7}
              >
                <View
                  className={`w-9 h-9 rounded-full items-center justify-center mr-3 ${
                    agent.agent_id === selectedAgentId ? 'bg-indigo-500' : 'bg-gray-100'
                  }`}
                >
                  <Ionicons
                    name="hardware-chip-outline"
                    size={16}
                    color={agent.agent_id === selectedAgentId ? '#FFFFFF' : '#6366F1'}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-gray-900">
                    {agent.display_name}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {agent.agent_id}
                  </Text>
                </View>
                {agent.agent_id === selectedAgentId && (
                  <Ionicons name="checkmark-circle" size={22} color="#6366F1" />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
        <TouchableOpacity
          className="mt-2 bg-indigo-50 rounded-xl py-3 items-center"
          onPress={() => router.push('/agent/claim')}
          activeOpacity={0.7}
        >
          <Text className="text-indigo-600 font-semibold text-sm">+ Claim Agent</Text>
        </TouchableOpacity>
      </View>

      {/* Settings */}
      <View className="mx-4 mb-4">
        <Text className="text-sm font-semibold text-gray-500 mb-2 ml-1">
          SETTINGS
        </Text>
        <View className="bg-white rounded-xl overflow-hidden">
          <TouchableOpacity className="flex-row items-center px-4 py-3 border-b border-gray-50">
            <Ionicons name="moon-outline" size={20} color="#64748B" />
            <Text className="flex-1 ml-3 text-base text-gray-900">
              Dark Mode
            </Text>
            <Text className="text-sm text-gray-400">System</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" className="ml-1" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center px-4 py-3 border-b border-gray-50">
            <Ionicons name="language-outline" size={20} color="#64748B" />
            <Text className="flex-1 ml-3 text-base text-gray-900">
              Language
            </Text>
            <Text className="text-sm text-gray-400">English</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" className="ml-1" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center px-4 py-3">
            <Ionicons name="information-circle-outline" size={20} color="#64748B" />
            <Text className="flex-1 ml-3 text-base text-gray-900">
              About
            </Text>
            <Text className="text-sm text-gray-400">v1.0.0</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" className="ml-1" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <View className="mx-4 mb-8">
        <TouchableOpacity
          className="bg-red-50 rounded-xl py-3.5 items-center"
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text className="text-red-500 font-semibold text-base">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
