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
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useTasksStore, type TaskItem } from '@/stores/tasks';
import { formatTimeAgo } from '@/lib/time';

const STATUS_COLUMNS = ['todo', 'doing', 'review', 'done', 'blocked'] as const;

const STATUS_CONFIG: Record<
  TaskItem['status'],
  { label: string; dotColor: string; bgColor: string; textColor: string; dot: string; bg: string; text: string }
> = {
  todo: { label: 'To Do', dotColor: '#6366F1', bgColor: '#EEF2FF', textColor: '#4338CA', dot: 'bg-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  doing: { label: 'Doing', dotColor: '#22C55E', bgColor: '#F0FDF4', textColor: '#15803D', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  review: { label: 'Review', dotColor: '#F59E0B', bgColor: '#FFFBEB', textColor: '#B45309', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  done: { label: 'Done', dotColor: '#10B981', bgColor: '#ECFDF5', textColor: '#047857', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  blocked: { label: 'Blocked', dotColor: '#EF4444', bgColor: '#FEF2F2', textColor: '#B91C1C', dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
};

const PRIORITY_CONFIG: Record<TaskItem['priority'], { bgColor: string; textColor: string; bg: string; text: string }> = {
  P0: { bgColor: '#FEE2E2', textColor: '#B91C1C', bg: 'bg-red-100', text: 'text-red-700' },
  P1: { bgColor: '#FFEDD5', textColor: '#C2410C', bg: 'bg-orange-100', text: 'text-orange-700' },
  P2: { bgColor: '#FEF9C3', textColor: '#A16207', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  P3: { bgColor: '#F3F4F6', textColor: '#6B7280', bg: 'bg-gray-100', text: 'text-gray-500' },
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
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark" style={styles.noAgent}>
        <Ionicons name="person-outline" size={48} color="#94A3B8" />
        <Text className="mt-4 text-gray-400 text-base font-inter" style={styles.noAgentText}>
          Select an agent to view tasks
        </Text>
      </View>
    );
  }

  if (isLoading && tasks.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark" style={styles.noAgent}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const renderTaskCard = ({ item }: { item: TaskItem }) => {
    const prio = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.P3;
    return (
      <TouchableOpacity
        className="bg-white dark:bg-zinc-800 rounded-xl p-3 mb-2 shadow-sm"
        style={styles.taskCard}
        activeOpacity={0.7}
        onPress={() => handleTaskPress(item)}
      >
        <Text
          className="text-sm font-inter-semibold text-gray-900 dark:text-gray-100 mb-1"
          style={styles.taskTitle}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <View className="flex-row items-center mb-1.5 gap-1.5" style={styles.badgeRow}>
          <View className={`px-1.5 py-0.5 rounded ${prio.bg}`} style={[styles.prioBadge, { backgroundColor: prio.bgColor }]}>
            <Text className={`text-xs font-inter-semibold ${prio.text}`} style={{ fontSize: 12, fontWeight: '600', color: prio.textColor }}>{item.priority}</Text>
          </View>
          {item.task_type ? (
            <View className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30" style={styles.typeBadge}>
              <Text className="text-xs font-inter text-blue-600 dark:text-blue-400" style={styles.typeText}>
                {item.task_type}
              </Text>
            </View>
          ) : null}
        </View>

        {item.description ? (
          <Text
            className="text-xs text-gray-500 dark:text-gray-400 font-inter mb-1"
            style={styles.taskDesc}
            numberOfLines={2}
          >
            {item.description}
          </Text>
        ) : null}

        {item.created_at ? (
          <Text className="text-xs text-gray-400 dark:text-gray-500 font-inter" style={styles.taskTime}>
            {formatTimeAgo(item.created_at)}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark" style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {STATUS_COLUMNS.map((status) => {
          const config = STATUS_CONFIG[status];
          const columnTasks = tasksByStatus[status] || [];
          return (
            <View key={status} className="mr-3" style={[styles.column, { width: 280, marginRight: 12 }]}>
              {/* Column header */}
              <View className={`flex-row items-center px-3 py-2 rounded-t-xl ${config.bg}`} style={[styles.colHeader, { backgroundColor: config.bgColor }]}>
                <View className={`w-2.5 h-2.5 rounded-full mr-2 ${config.dot}`} style={[styles.colDot, { backgroundColor: config.dotColor }]} />
                <Text className={`text-sm font-inter-semibold ${config.text}`} style={{ fontSize: 14, fontWeight: '600', color: config.textColor }}>
                  {config.label}
                </Text>
                <View className="ml-auto bg-white/60 dark:bg-black/20 rounded-full px-2 py-0.5" style={styles.colCount}>
                  <Text className={`text-xs font-inter-semibold ${config.text}`} style={{ fontSize: 12, fontWeight: '600', color: config.textColor }}>
                    {columnTasks.length}
                  </Text>
                </View>
              </View>

              {/* Column body */}
              <View className="flex-1 bg-gray-50 dark:bg-zinc-900 rounded-b-xl p-2" style={styles.colBody}>
                <FlatList
                  data={columnTasks}
                  keyExtractor={(item) => item.id}
                  renderItem={renderTaskCard}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View className="items-center py-8" style={styles.colEmpty}>
                      <Text className="text-gray-400 font-inter text-sm" style={styles.colEmptyText}>No tasks</Text>
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
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Task Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40" style={styles.modalOverlay}>
          <View className="bg-white dark:bg-zinc-800 rounded-t-2xl p-6" style={styles.modalContent}>
            <View className="flex-row items-center justify-between mb-4" style={styles.modalHeader}>
              <Text className="text-lg font-inter-semibold text-gray-900 dark:text-gray-100" style={styles.modalTitle}>
                New Task
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text className="text-sm font-inter text-gray-500 dark:text-gray-400 mb-1" style={styles.modalLabel}>
              Title
            </Text>
            <TextInput
              className="bg-gray-50 dark:bg-zinc-700 rounded-xl px-4 py-3 text-base font-inter text-gray-900 dark:text-gray-100 mb-4"
              style={styles.modalInput}
              placeholder="Task title"
              placeholderTextColor="#9CA3AF"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <Text className="text-sm font-inter text-gray-500 dark:text-gray-400 mb-2" style={styles.modalLabel}>
              Type
            </Text>
            <View className="flex-row gap-2 mb-6" style={styles.typeRow}>
              {TASK_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  className={`flex-1 py-2.5 rounded-xl items-center ${
                    newType === t
                      ? 'bg-primary'
                      : 'bg-gray-100 dark:bg-zinc-700'
                  }`}
                  style={[styles.typeButton, newType === t ? styles.typeActive : styles.typeInactive]}
                  onPress={() => setNewType(t)}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-sm font-inter-semibold ${
                      newType === t
                        ? 'text-white'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                    style={newType === t ? styles.typeTextActive : styles.typeTextInactive}
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
              style={[styles.createButton, newTitle.trim() ? styles.createEnabled : styles.createDisabled]}
              onPress={handleCreate}
              disabled={!newTitle.trim()}
              activeOpacity={0.8}
            >
              <Text className="text-white font-inter-semibold text-base" style={styles.createText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    flex: 1,
  },
  column: {
    marginRight: 12,
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  colDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  colCount: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  colBody: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 8,
  },
  colEmpty: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  colEmptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  prioBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
  },
  typeText: {
    fontSize: 12,
    color: '#2563EB',
  },
  taskDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  taskTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  noAgent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  noAgentText: {
    marginTop: 16,
    color: '#9CA3AF',
    fontSize: 16,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  typeActive: {
    backgroundColor: '#6366F1',
  },
  typeInactive: {
    backgroundColor: '#F3F4F6',
  },
  typeTextActive: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  typeTextInactive: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createEnabled: {
    backgroundColor: '#6366F1',
  },
  createDisabled: {
    backgroundColor: '#D1D5DB',
  },
  createText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
