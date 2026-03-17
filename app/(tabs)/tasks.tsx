import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TasksScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
      <Ionicons name="clipboard-outline" size={48} color="#94A3B8" />
      <Text className="text-gray-400 font-inter mt-4 text-base">Tasks</Text>
      <Text className="text-gray-400 font-inter text-sm mt-1">Coming in Phase 2</Text>
    </View>
  );
}
