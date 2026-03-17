import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const agents = useAgentsStore((s) => s.agents);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView className="flex-1 bg-background-light dark:bg-background-dark">
      {/* User Info */}
      <View className="items-center pt-8 pb-6">
        <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-3">
          <Text className="text-white text-2xl font-inter-bold">
            {(user?.display_name || user?.username || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text className="text-lg font-inter-semibold text-gray-900 dark:text-gray-100">
          {user?.display_name || user?.username || 'User'}
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 font-inter">
          {user?.email || ''}
        </Text>
      </View>

      {/* Agent Section */}
      <View className="mx-4 mb-4">
        <Text className="text-sm font-inter-semibold text-gray-500 dark:text-gray-400 mb-2 ml-1">
          AGENTS
        </Text>
        <View className="bg-white dark:bg-zinc-800 rounded-xl overflow-hidden">
          {agents.length === 0 ? (
            <View className="px-4 py-3">
              <Text className="text-gray-400 font-inter text-sm">No agents claimed</Text>
            </View>
          ) : (
            agents.map((agent) => (
              <View
                key={agent.agent_id}
                className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-zinc-700"
              >
                <View className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900 items-center justify-center mr-3">
                  <Ionicons name="hardware-chip-outline" size={16} color="#6366F1" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-inter text-gray-900 dark:text-gray-100">
                    {agent.display_name}
                  </Text>
                  <Text className="text-xs text-gray-400 font-inter">
                    {agent.agent_id}
                  </Text>
                </View>
                {agent.agent_id === selectedAgentId && (
                  <Ionicons name="checkmark-circle" size={20} color="#6366F1" />
                )}
              </View>
            ))
          )}
        </View>
      </View>

      {/* Settings */}
      <View className="mx-4 mb-4">
        <Text className="text-sm font-inter-semibold text-gray-500 dark:text-gray-400 mb-2 ml-1">
          SETTINGS
        </Text>
        <View className="bg-white dark:bg-zinc-800 rounded-xl overflow-hidden">
          <TouchableOpacity className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-zinc-700">
            <Ionicons name="moon-outline" size={20} color="#64748B" />
            <Text className="flex-1 ml-3 text-base font-inter text-gray-900 dark:text-gray-100">
              Dark Mode
            </Text>
            <Text className="text-sm text-gray-400 font-inter">System</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center px-4 py-3">
            <Ionicons name="language-outline" size={20} color="#64748B" />
            <Text className="flex-1 ml-3 text-base font-inter text-gray-900 dark:text-gray-100">
              Language
            </Text>
            <Text className="text-sm text-gray-400 font-inter">English</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <View className="mx-4 mb-8">
        <TouchableOpacity
          className="bg-red-50 dark:bg-red-900/20 rounded-xl py-3 items-center"
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text className="text-red-500 font-inter-semibold text-base">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
