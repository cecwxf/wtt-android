import { useEffect, useMemo, useState, useCallback } from 'react';
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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useTasksStore, type TaskItem } from '@/stores/tasks';
import { formatTimeAgo, formatTime } from '@/lib/time';
import type { Message } from '@/lib/api/wtt-client';

const STATUS_COLUMNS: TaskItem['status'][] = ['todo', 'doing', 'review', 'done', 'blocked'];

const STATUS_CONFIG: Record<TaskItem['status'], { label: string; color: string; bg: string }> = {
  todo: { label: 'To Do', color: '#4338CA', bg: '#EEF2FF' },
  doing: { label: 'Doing', color: '#15803D', bg: '#F0FDF4' },
  review: { label: 'Review', color: '#B45309', bg: '#FFFBEB' },
  done: { label: 'Done', color: '#047857', bg: '#ECFDF5' },
  blocked: { label: 'Blocked', color: '#B91C1C', bg: '#FEF2F2' },
};

const GENERAL_TYPES = new Set(['', 'general', 'feature', 'common']);

function isGeneralTask(task: TaskItem): boolean {
  const t = String(task.task_type || '').toLowerCase();
  return GENERAL_TYPES.has(t);
}

export default function TasksScreen() {
  const token = useAuthStore((s) => s.token);
  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);

  const {
    tasks,
    isLoading,
    fetchTasks,
    createTask,
    deleteTask,
    runTask,
    reviewTask,
    updateTaskStatus,
    fetchTaskTimeline,
    sendTaskChat,
    timelineByTask,
    timelineLoadingTaskId,
    error,
  } = useTasksStore();

  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskChatText, setTaskChatText] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

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

  const generalTasks = useMemo(() => tasks.filter(isGeneralTask), [tasks]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskItem['status'], TaskItem[]> = {
      todo: [],
      doing: [],
      review: [],
      done: [],
      blocked: [],
    };
    for (const t of generalTasks) grouped[t.status].push(t);
    return grouped;
  }, [generalTasks]);

  const selectedTask = useMemo(
    () => generalTasks.find((t) => t.id === selectedTaskId) || null,
    [generalTasks, selectedTaskId],
  );

  const timeline = useMemo(() => {
    if (!selectedTaskId) return [];
    return timelineByTask[selectedTaskId] || [];
  }, [timelineByTask, selectedTaskId]);

  useEffect(() => {
    if (!panelOpen || !selectedTask || !token) return;
    fetchTaskTimeline(token, selectedTask.id, selectedTask.topic_id, selectedAgentId || undefined);
  }, [panelOpen, selectedTask, token, selectedAgentId, fetchTaskTimeline]);

  useEffect(() => {
    if (!panelOpen || !selectedTask || !token) return;
    const timer = setInterval(() => {
      fetchTaskTimeline(
        token,
        selectedTask.id,
        selectedTask.topic_id,
        selectedAgentId || undefined,
      );
      loadTasks();
    }, 10000);
    return () => clearInterval(timer);
  }, [panelOpen, selectedTask, token, selectedAgentId, fetchTaskTimeline, loadTasks]);

  const openTaskPanel = (task: TaskItem) => {
    setSelectedTaskId(task.id);
    setPanelOpen(true);
    setTaskChatText('');
  };

  const closeTaskPanel = () => {
    setPanelOpen(false);
    setSelectedTaskId(null);
    setTaskChatText('');
  };

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title || !token || !selectedAgentId || creating) return;

    setCreating(true);
    const created = await createTask(token, {
      title,
      description: newDesc.trim() || undefined,
      task_type: 'general',
      owner_agent_id: selectedAgentId,
      status: 'todo',
    });
    setCreating(false);

    if (!created) {
      Alert.alert('Create failed', 'Please retry.');
      return;
    }

    setCreateOpen(false);
    setNewTitle('');
    setNewDesc('');
  };

  const runCurrent = async () => {
    if (!selectedTask || !token || !selectedAgentId || actionBusy) return;
    setActionBusy(true);
    try {
      await runTask(token, selectedTask, selectedAgentId);
      await fetchTaskTimeline(token, selectedTask.id, selectedTask.topic_id, selectedAgentId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Run failed';
      Alert.alert('Run failed', msg);
    } finally {
      setActionBusy(false);
    }
  };

  const reviewCurrent = async (action: 'approve' | 'reject' | 'block') => {
    if (!selectedTask || !token || !selectedAgentId || actionBusy) return;
    setActionBusy(true);
    try {
      await reviewTask(token, selectedTask.id, action, selectedAgentId);
      await fetchTaskTimeline(token, selectedTask.id, selectedTask.topic_id, selectedAgentId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Review failed';
      Alert.alert('Review failed', msg);
    } finally {
      setActionBusy(false);
    }
  };

  const moveCurrentStatus = async (status: TaskItem['status']) => {
    if (!selectedTask || !token || actionBusy) return;
    setActionBusy(true);
    try {
      await updateTaskStatus(token, selectedTask.id, status);
      await fetchTaskTimeline(
        token,
        selectedTask.id,
        selectedTask.topic_id,
        selectedAgentId || undefined,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Status update failed';
      Alert.alert('Status update failed', msg);
    } finally {
      setActionBusy(false);
    }
  };

  const openCurrentTopicChat = () => {
    if (!selectedTask?.topic_id) {
      Alert.alert('No topic', 'This task has no linked topic yet.');
      return;
    }
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: selectedTask.topic_id,
        name: selectedTask.title,
      },
    });
  };

  const deleteCurrent = () => {
    if (!selectedTask || !token || actionBusy) return;
    Alert.alert('Cancel task', `Delete task “${selectedTask.title}”?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setActionBusy(true);
          await deleteTask(token, selectedTask.id, selectedAgentId || undefined);
          setActionBusy(false);
          closeTaskPanel();
        },
      },
    ]);
  };

  const sendCurrentChat = async () => {
    if (!selectedTask || !token || !selectedAgentId || actionBusy) return;
    const text = taskChatText.trim();
    if (!text) return;
    setActionBusy(true);
    try {
      await sendTaskChat(token, selectedTask, selectedAgentId, text);
      setTaskChatText('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Send failed';
      Alert.alert('Send failed', msg);
    } finally {
      setActionBusy(false);
    }
  };

  if (!selectedAgentId) {
    return (
      <View style={styles.centerWrap}>
        <Ionicons name="person-outline" size={48} color="#94A3B8" />
        <Text style={styles.centerText}>Select an agent to view tasks</Text>
      </View>
    );
  }

  if (isLoading && generalTasks.length === 0) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  const renderTaskCard = ({ item }: { item: TaskItem }) => {
    const cfg = STATUS_CONFIG[item.status];
    return (
      <TouchableOpacity
        style={styles.taskCard}
        activeOpacity={0.8}
        onPress={() => openTaskPanel(item)}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        {item.description ? (
          <Text style={styles.taskDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.cardFooterRow}>
          <Text style={styles.taskMeta}>{item.priority || 'P2'}</Text>
          <Text style={styles.taskMeta}>
            {item.created_at ? formatTimeAgo(item.created_at) : '-'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const status = selectedTask ? selectedTask.status : 'todo';
  const statusCfg = STATUS_CONFIG[status];

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>General Task Panel</Text>
        <Text style={styles.topSub}>{generalTasks.length} tasks</Text>
      </View>

      <ScrollView
        horizontal
        style={styles.columnsScroll}
        contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
      >
        {STATUS_COLUMNS.map((statusKey) => {
          const cfg = STATUS_CONFIG[statusKey];
          const columnTasks = tasksByStatus[statusKey] || [];
          return (
            <View key={statusKey} style={styles.column}>
              <View style={[styles.columnHeader, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.columnTitle, { color: cfg.color }]}>{cfg.label}</Text>
                <Text style={[styles.columnCount, { color: cfg.color }]}>{columnTasks.length}</Text>
              </View>
              <FlatList
                data={columnTasks}
                keyExtractor={(item) => item.id}
                renderItem={renderTaskCard}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 8, paddingBottom: 20 }}
                ListEmptyComponent={<Text style={styles.emptyColumn}>No tasks</Text>}
              />
            </View>
          );
        })}
      </ScrollView>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity style={styles.fab} onPress={() => setCreateOpen(true)}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={createOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>New General Task</Text>
              <TouchableOpacity onPress={() => setCreateOpen(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Title"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { height: 90 }]}
              placeholder="Description (optional)"
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />
            <TouchableOpacity
              style={[styles.modalPrimaryBtn, (!newTitle.trim() || creating) && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={!newTitle.trim() || creating}
            >
              <Text style={styles.modalPrimaryText}>{creating ? 'Creating...' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={panelOpen} animationType="slide" transparent onRequestClose={closeTaskPanel}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '88%' }]}>
            {!selectedTask ? (
              <View style={styles.centerWrap}>
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            ) : (
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.panelTitle} numberOfLines={2}>
                      {selectedTask.title}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        { marginTop: 6, alignSelf: 'flex-start', backgroundColor: statusCfg.bg },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: statusCfg.color }]}>
                        {statusCfg.label}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={closeTaskPanel}>
                    <Ionicons name="close" size={22} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.panelActionRow}>
                  {(selectedTask.status === 'todo' || selectedTask.status === 'doing') && (
                    <TouchableOpacity
                      style={styles.actionPrimary}
                      onPress={runCurrent}
                      disabled={actionBusy}
                    >
                      <Text style={styles.actionPrimaryText}>Run</Text>
                    </TouchableOpacity>
                  )}

                  {selectedTask.status === 'todo' && (
                    <TouchableOpacity
                      style={styles.actionPrimary}
                      onPress={() => moveCurrentStatus('doing')}
                      disabled={actionBusy}
                    >
                      <Text style={styles.actionPrimaryText}>Move → Doing</Text>
                    </TouchableOpacity>
                  )}

                  {selectedTask.status === 'doing' && (
                    <TouchableOpacity
                      style={styles.actionWarn}
                      onPress={() => moveCurrentStatus('review')}
                      disabled={actionBusy}
                    >
                      <Text style={styles.actionWarnText}>Move → Review</Text>
                    </TouchableOpacity>
                  )}

                  {selectedTask.status === 'review' && (
                    <>
                      <TouchableOpacity
                        style={styles.actionPrimary}
                        onPress={() => reviewCurrent('approve')}
                        disabled={actionBusy}
                      >
                        <Text style={styles.actionPrimaryText}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionWarn}
                        onPress={() => reviewCurrent('reject')}
                        disabled={actionBusy}
                      >
                        <Text style={styles.actionWarnText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionWarn}
                        onPress={() => reviewCurrent('block')}
                        disabled={actionBusy}
                      >
                        <Text style={styles.actionWarnText}>Block</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {(selectedTask.status === 'done' || selectedTask.status === 'blocked') && (
                    <TouchableOpacity
                      style={styles.actionPrimary}
                      onPress={() => moveCurrentStatus('todo')}
                      disabled={actionBusy}
                    >
                      <Text style={styles.actionPrimaryText}>Reopen → To Do</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionGhost}
                    onPress={openCurrentTopicChat}
                    disabled={actionBusy}
                  >
                    <Text style={styles.actionGhostText}>Open Topic</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionDanger}
                    onPress={deleteCurrent}
                    disabled={actionBusy}
                  >
                    <Text style={styles.actionDangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.metaCard}>
                  <Text style={styles.metaLine}>Task ID: {selectedTask.id}</Text>
                  <Text style={styles.metaLine}>Owner: {selectedTask.owner_agent_id || '-'}</Text>
                  <Text style={styles.metaLine}>Runner: {selectedTask.runner_agent_id || '-'}</Text>
                  <Text style={styles.metaLine}>Topic: {selectedTask.topic_id || '-'}</Text>
                  <Text style={styles.metaLine}>
                    Updated:{' '}
                    {selectedTask.updated_at ? formatTimeAgo(selectedTask.updated_at) : '-'}
                  </Text>
                </View>

                <View style={styles.timelineWrap}>
                  {timelineLoadingTaskId === selectedTask.id ? (
                    <View style={styles.centerWrap}>
                      <ActivityIndicator size="small" color="#6366F1" />
                    </View>
                  ) : timeline.length === 0 ? (
                    <Text style={styles.emptyTimeline}>No timeline messages yet</Text>
                  ) : (
                    <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
                      {timeline.map((m: Message) => {
                        const isHuman = m.sender_type === 'human';
                        const stamp = (m.timestamp || '').trim()
                          ? m.timestamp
                          : new Date().toISOString();
                        return (
                          <View
                            key={m.message_id}
                            style={[styles.msgItem, isHuman ? styles.msgHuman : styles.msgAgent]}
                          >
                            <Text style={styles.msgSender}>{m.sender_id}</Text>
                            <Text style={styles.msgContent}>{m.content}</Text>
                            <Text style={styles.msgTime}>{formatTime(stamp)}</Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>

                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Send to task..."
                    value={taskChatText}
                    onChangeText={setTaskChatText}
                    multiline
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      (!taskChatText.trim() || actionBusy) && { opacity: 0.6 },
                    ]}
                    onPress={sendCurrentChat}
                    disabled={!taskChatText.trim() || actionBusy}
                  >
                    <Ionicons name="send" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { marginTop: 16, fontSize: 16, color: '#94A3B8' },

  topBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  topSub: { marginTop: 2, fontSize: 12, color: '#64748B' },

  columnsScroll: { flex: 1 },
  column: {
    width: 290,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  columnTitle: { fontSize: 13, fontWeight: '700' },
  columnCount: { fontSize: 12, fontWeight: '700' },
  emptyColumn: { paddingVertical: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 },

  taskCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start' },
  taskTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827', marginRight: 8 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  taskDesc: { marginTop: 6, fontSize: 12, color: '#64748B' },
  cardFooterRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  taskMeta: { fontSize: 11, color: '#94A3B8' },

  errorText: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 86,
    textAlign: 'center',
    fontSize: 12,
    color: '#B91C1C',
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 8,
  },
  modalPrimaryBtn: {
    marginTop: 6,
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  panelTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  panelActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  actionPrimary: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionPrimaryText: { color: '#4338CA', fontSize: 12, fontWeight: '700' },
  actionWarn: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionWarnText: { color: '#B45309', fontSize: 12, fontWeight: '700' },
  actionGhost: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionGhostText: { color: '#334155', fontSize: 12, fontWeight: '700' },
  actionDanger: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionDangerText: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },

  metaCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 3,
  },
  metaLine: { fontSize: 11, color: '#475569' },

  timelineWrap: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    minHeight: 180,
    maxHeight: 360,
    padding: 8,
    marginBottom: 10,
  },
  emptyTimeline: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontSize: 12 },
  msgItem: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  msgHuman: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  msgAgent: { backgroundColor: '#fff', borderColor: '#E2E8F0' },
  msgSender: { fontSize: 11, fontWeight: '700', color: '#475569' },
  msgContent: { marginTop: 4, fontSize: 13, color: '#1E293B' },
  msgTime: { marginTop: 4, fontSize: 10, color: '#94A3B8' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    fontSize: 14,
    color: '#111827',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    marginBottom: 1,
  },
});
