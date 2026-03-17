import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useTasksStore, type TaskItem } from '@/stores/tasks';
import { formatTimeAgo } from '@/lib/time';

const STATUS_COLUMNS = ['todo', 'doing', 'review', 'done', 'blocked'] as const;

const STATUS_CONFIG: Record<
  TaskItem['status'],
  { label: string; dot: string; bg: string; text: string }
> = {
  todo: { label: 'To Do', dot: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  doing: { label: 'Doing', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  review: { label: 'Review', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  done: { label: 'Done', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  blocked: { label: 'Blocked', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
};

const PRIORITY_CONFIG: Record<TaskItem['priority'], { bg: string; text: string }> = {
  P0: { bg: 'bg-red-100', text: 'text-red-700' },
  P1: { bg: 'bg-orange-100', text: 'text-orange-700' },
  P2: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  P3: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const TASK_TYPES = ['common', 'code', 'research'] as const;

export default function TasksScreen() {
  const token = useAuthStore((s) => s.token);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const { tasks, isLoading, fetchTasks, createTask, updateTaskStatus, deleteTask } =
    useTasksStore();

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<string>('common');

  const loadTasks = useCallback(async () => {
    if (!token || !selectedAgentId) return;
    await fetchTasks(token, selectedAgentId);
  }, [token, selectedAgentId, fetchTasks]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  };

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, TaskItem[]> = {};
    for (const s of STATUS_COLUMNS) grouped[s] = [];
    for (const t of tasks) {
      if (grouped[t.status]) grouped[t.status].push(t);
      else grouped.todo.push(t);
    }
    return grouped;
  }, [tasks]);

  const handleTaskPress = (task: TaskItem) => {
    Alert.alert(task.title, `Status: ${task.status}\nPriority: ${task.priority}`, [
      {
        text: 'Change Status',
        onPress: () => {
          const options = STATUS_COLUMNS.filter((s) => s !== task.status);
          Alert.alert('Change Status', 'Select new status', [
            ...options.map((s) => ({
              text: STATUS_CONFIG[s].label,
              onPress: () => {
                if (token) updateTaskStatus(token, task.id, s);
              },
            })),
            { text: 'Cancel', style: 'cancel' as const },
          ]);
        },
      },
      {
        text: 'Delete',
        style: 'destructive' as const,
        onPress: () => {
          Alert.alert('Delete Task', `Delete "${task.title}"?`, [
            { text: 'Cancel', style: 'cancel' as const },
            {
              text: 'Delete',
              style: 'destructive' as const,
              onPress: () => {
                if (token) deleteTask(token, task.id);
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title || !token || !selectedAgentId) return;
    await createTask(token, {
      title,
      task_type: newType,
      owner_agent_id: selectedAgentId,
    });
    setNewTitle('');
    setNewType('common');
    setModalVisible(false);
  };

  if (!selectedAgentId) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <Ionicons name="person-outline" size={48} color="#94A3B8" />
        <Text className="mt-4 text-gray-400 text-base font-inter">
          Select an agent to view tasks
        </Text>
      </View>
    );
  }

  if (isLoading && tasks.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const renderTaskCard = ({ item }: { item: TaskItem }) => {
    const prio = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.P3;
    return (
      <TouchableOpacity
        className="bg-white dark:bg-zinc-800 rounded-xl p-3 mb-2 shadow-sm"
        activeOpacity={0.7}
        onPress={() => handleTaskPress(item)}
      >
        <Text
          className="text-sm font-inter-semibold text-gray-900 dark:text-gray-100 mb-1"
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <View className="flex-row items-center mb-1.5 gap-1.5">
          <View className={`px-1.5 py-0.5 rounded ${prio.bg}`}>
            <Text className={`text-xs font-inter-semibold ${prio.text}`}>{item.priority}</Text>
          </View>
          {item.task_type ? (
            <View className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30">
              <Text className="text-xs font-inter text-blue-600 dark:text-blue-400">
                {item.task_type}
              </Text>
            </View>
          ) : null}
        </View>

        {item.description ? (
          <Text
            className="text-xs text-gray-500 dark:text-gray-400 font-inter mb-1"
            numberOfLines={2}
          >
            {item.description}
          </Text>
        ) : null}

        {item.created_at ? (
          <Text className="text-xs text-gray-400 dark:text-gray-500 font-inter">
            {formatTimeAgo(item.created_at)}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {STATUS_COLUMNS.map((status) => {
          const config = STATUS_CONFIG[status];
          const columnTasks = tasksByStatus[status] || [];
          return (
            <View key={status} className="mr-3" style={{ width: 280 }}>
              {/* Column header */}
              <View className={`flex-row items-center px-3 py-2 rounded-t-xl ${config.bg}`}>
                <View className={`w-2.5 h-2.5 rounded-full mr-2 ${config.dot}`} />
                <Text className={`text-sm font-inter-semibold ${config.text}`}>
                  {config.label}
                </Text>
                <View className="ml-auto bg-white/60 dark:bg-black/20 rounded-full px-2 py-0.5">
                  <Text className={`text-xs font-inter-semibold ${config.text}`}>
                    {columnTasks.length}
                  </Text>
                </View>
              </View>

              {/* Column body */}
              <View className="flex-1 bg-gray-50 dark:bg-zinc-900 rounded-b-xl p-2">
                <FlatList
                  data={columnTasks}
                  keyExtractor={(item) => item.id}
                  renderItem={renderTaskCard}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View className="items-center py-8">
                      <Text className="text-gray-400 font-inter text-sm">No tasks</Text>
                    </View>
                  }
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Task Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white dark:bg-zinc-800 rounded-t-2xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-inter-semibold text-gray-900 dark:text-gray-100">
                New Task
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text className="text-sm font-inter text-gray-500 dark:text-gray-400 mb-1">
              Title
            </Text>
            <TextInput
              className="bg-gray-50 dark:bg-zinc-700 rounded-xl px-4 py-3 text-base font-inter text-gray-900 dark:text-gray-100 mb-4"
              placeholder="Task title"
              placeholderTextColor="#9CA3AF"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <Text className="text-sm font-inter text-gray-500 dark:text-gray-400 mb-2">
              Type
            </Text>
            <View className="flex-row gap-2 mb-6">
              {TASK_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  className={`flex-1 py-2.5 rounded-xl items-center ${
                    newType === t
                      ? 'bg-primary'
                      : 'bg-gray-100 dark:bg-zinc-700'
                  }`}
                  onPress={() => setNewType(t)}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-sm font-inter-semibold ${
                      newType === t
                        ? 'text-white'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              className={`rounded-xl py-3.5 items-center ${
                newTitle.trim() ? 'bg-primary' : 'bg-gray-300 dark:bg-zinc-600'
              }`}
              onPress={handleCreate}
              disabled={!newTitle.trim()}
              activeOpacity={0.8}
            >
              <Text className="text-white font-inter-semibold text-base">Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
