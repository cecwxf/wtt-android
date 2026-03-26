import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useWebSocketStore } from '@/stores/websocket';
import { WTT_API_URL } from '@/lib/api/base-url';
import { formatTimeAgo } from '@/lib/time';

type TopicType = 'broadcast' | 'discussion' | 'p2p' | 'collaborative';

interface FeedTopic {
  id: string;
  name: string;
  description?: string;
  type?: TopicType;
  topic_type?: TopicType;
  last_activity_at?: string;
  last_message_at?: string;
  created_at?: string;
  unread_count?: number;
  task_id?: string;
  task_type?: string;
  my_role?: string;
}

interface P2PRequestItem {
  id: string;
  from_agent_id?: string;
  target_agent_id?: string;
  request_type?: string;
  message?: string;
}

const GENERAL_TASK_TYPES = new Set(['', 'general', 'feature', 'common']);

function topicKind(t: FeedTopic): TopicType {
  return (t.topic_type || t.type || 'discussion') as TopicType;
}

function topicTime(t: FeedTopic): string {
  return t.last_activity_at || t.last_message_at || t.created_at || new Date().toISOString();
}

function isGeneralTaskTopic(t: FeedTopic): boolean {
  if (!t.task_id) return false;
  const raw = String(t.task_type || '').toLowerCase();
  return GENERAL_TASK_TYPES.has(raw);
}

export default function FeedScreen() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const selectedAgentId = useAgentsStore((s) => s.selectedAgentId);
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);
  const loadSelectedAgent = useAgentsStore((s) => s.loadSelectedAgent);

  const wsState = useWebSocketStore((s) => s.wsState);

  const [topics, setTopics] = useState<FeedTopic[]>([]);
  const [p2pRequests, setP2pRequests] = useState<P2PRequestItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [taskCreating, setTaskCreating] = useState(false);

  const [createP2POpen, setCreateP2POpen] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState('');
  const [p2pCreating, setP2PCreating] = useState(false);

  const [createDiscussOpen, setCreateDiscussOpen] = useState(false);
  const [discussTargetAgentId, setDiscussTargetAgentId] = useState('');
  const [discussTopicName, setDiscussTopicName] = useState('');
  const [discussCreating, setDiscussCreating] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTopicId, setInviteTopicId] = useState('');
  const [inviteTopicName, setInviteTopicName] = useState('');
  const [inviteAgentId, setInviteAgentId] = useState('');
  const [inviteCreating, setInviteCreating] = useState(false);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.agent_id === selectedAgentId),
    [agents, selectedAgentId],
  );

  const wsColor =
    wsState === 'connected' ? '#22C55E' : wsState === 'connecting' ? '#EAB308' : '#D1D5DB';

  const fetchFeedData = useCallback(async () => {
    if (!token || !selectedAgentId) {
      setLoading(false);
      return;
    }

    try {
      const topicRes = await fetch(
        `${WTT_API_URL}/api/topics/subscribed?agent_id=${encodeURIComponent(selectedAgentId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (topicRes.ok) {
        const data = await topicRes.json();
        const list = (Array.isArray(data) ? data : data.topics || []) as FeedTopic[];
        list.sort((a, b) => new Date(topicTime(b)).getTime() - new Date(topicTime(a)).getTime());
        setTopics(list);
      }

      const userId = user?.id ? String(user.id) : '';
      if (userId) {
        const reqRes = await fetch(
          `${WTT_API_URL}/api/p2p-requests/for-user?user_id=${encodeURIComponent(userId)}&status=pending`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (reqRes.ok) {
          const data = await reqRes.json();
          const list = (Array.isArray(data) ? data : data.requests || []) as P2PRequestItem[];
          setP2pRequests(list);
        } else {
          setP2pRequests([]);
        }
      } else {
        setP2pRequests([]);
      }
    } catch {
      // ignore transient network issues on feed
    } finally {
      setLoading(false);
    }
  }, [token, selectedAgentId, user?.id]);

  useEffect(() => {
    if (token) {
      loadSelectedAgent();
      fetchAgents(token);
    }
  }, [token, fetchAgents, loadSelectedAgent]);

  useEffect(() => {
    fetchFeedData();
  }, [fetchFeedData]);

  useEffect(() => {
    if (!token || !selectedAgentId) return;
    const timer = setInterval(fetchFeedData, 15000);
    return () => clearInterval(timer);
  }, [token, selectedAgentId, fetchFeedData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeedData();
    setRefreshing(false);
  };

  const grouped = useMemo(() => {
    const generalTasks = topics.filter((t) => isGeneralTaskTopic(t));
    const p2p = topics.filter((t) => topicKind(t) === 'p2p' && !t.task_id);
    const discuss = topics.filter((t) => {
      const type = topicKind(t);
      return !t.task_id && (type === 'discussion' || type === 'collaborative');
    });
    const subscriber = topics.filter((t) => !t.task_id && topicKind(t) === 'broadcast');

    return { generalTasks, p2p, discuss, subscriber };
  }, [topics]);

  const openTopic = (topic: FeedTopic) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: topic.id, name: topic.name },
    });
  };

  const handleCreateGeneralTask = async () => {
    const title = newTaskTitle.trim();
    if (!token || !selectedAgentId || !title || taskCreating) return;

    setTaskCreating(true);
    try {
      const res = await fetch(`${WTT_API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description: newTaskDesc.trim() || undefined,
          task_type: 'general',
          owner_agent_id: selectedAgentId,
          status: 'todo',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to create task' }));
        throw new Error(err.detail || 'Failed to create task');
      }
      const task = await res.json();
      setCreateTaskOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      await fetchFeedData();
      if (task?.topic_id) {
        openTopic({ id: String(task.topic_id), name: String(task.title || 'General Task Topic') });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create task';
      Alert.alert('Create task failed', msg);
    } finally {
      setTaskCreating(false);
    }
  };

  const handleCreateP2PRequest = async () => {
    const target = targetAgentId.trim();
    if (!token || !selectedAgentId || !target || p2pCreating) return;

    setP2PCreating(true);
    try {
      const fromUserId = user?.id ? String(user.id) : selectedAgentId;
      const res = await fetch(`${WTT_API_URL}/api/p2p-requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_user_id: fromUserId,
          from_agent_id: selectedAgentId,
          target_agent_id: target,
          message: `P2P chat request from ${selectedAgent?.display_name || selectedAgentId}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to send P2P request' }));
        throw new Error(err.detail || 'Failed to send P2P request');
      }
      setCreateP2POpen(false);
      setTargetAgentId('');
      Alert.alert('Done', 'P2P request sent');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send P2P request';
      Alert.alert('P2P failed', msg);
    } finally {
      setP2PCreating(false);
    }
  };

  const handleCreateDiscussRequest = async () => {
    const target = discussTargetAgentId.trim();
    const topicName = discussTopicName.trim();
    if (!token || !selectedAgentId || !target || !topicName || discussCreating) return;

    setDiscussCreating(true);
    try {
      const fromUserId = user?.id ? String(user.id) : selectedAgentId;
      const res = await fetch(`${WTT_API_URL}/api/p2p-requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_user_id: fromUserId,
          from_agent_id: selectedAgentId,
          target_agent_id: target,
          request_type: 'discuss',
          topic_name: topicName,
          message: `Discussion invite from ${selectedAgent?.display_name || selectedAgentId}`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to send discuss request' }));
        throw new Error(err.detail || 'Failed to send discuss request');
      }
      setCreateDiscussOpen(false);
      setDiscussTargetAgentId('');
      setDiscussTopicName('');
      Alert.alert('Done', 'Discuss request sent');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send discuss request';
      Alert.alert('Discuss failed', msg);
    } finally {
      setDiscussCreating(false);
    }
  };

  const handleOpenInvite = (topic: FeedTopic) => {
    setInviteTopicId(topic.id);
    setInviteTopicName(topic.name || topic.id);
    setInviteAgentId('');
    setInviteOpen(true);
  };

  const handleInviteMember = async () => {
    const target = inviteAgentId.trim();
    if (!token || !inviteTopicId || !target || inviteCreating) return;

    setInviteCreating(true);
    try {
      const res = await fetch(
        `${WTT_API_URL}/api/topics/${inviteTopicId}/join?agent_id=${encodeURIComponent(target)}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to invite member' }));
        throw new Error(err.detail || 'Failed to invite member');
      }
      setInviteOpen(false);
      setInviteAgentId('');
      Alert.alert('Done', 'Member invited to discuss');
      await fetchFeedData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to invite member';
      Alert.alert('Invite failed', msg);
    } finally {
      setInviteCreating(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${WTT_API_URL}/api/p2p-requests/${requestId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to accept request' }));
        throw new Error(err.detail || 'Failed to accept request');
      }
      const data = await res.json().catch(() => ({}));
      await fetchFeedData();
      if (data?.topic_id) {
        openTopic({ id: String(data.topic_id), name: 'P2P' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to accept request';
      Alert.alert('Accept failed', msg);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!token) return;
    try {
      await fetch(`${WTT_API_URL}/api/p2p-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchFeedData();
    } catch {
      Alert.alert('Reject failed', 'Please retry');
    }
  };

  const renderTopicRow = (item: FeedTopic) => {
    const type = topicKind(item);
    const icon = type === 'p2p' ? 'person' : type === 'broadcast' ? 'radio' : 'chatbubbles';
    const subtitle = item.description || item.task_id || type;

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.topicRow}
        activeOpacity={0.75}
        onPress={() => openTopic(item)}
      >
        <View style={styles.topicIconWrap}>
          <Ionicons name={icon} size={18} color="#6366F1" />
        </View>
        <View style={styles.topicTextWrap}>
          <View style={styles.topicTitleLine}>
            <Text style={styles.topicTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.topicTime}>{formatTimeAgo(topicTime(item))}</Text>
          </View>
          <Text style={styles.topicDesc} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {(type === 'discussion' || type === 'collaborative') && (
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={() => handleOpenInvite(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="person-add-outline" size={14} color="#4F46E5" />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        )}

        {(item.unread_count || 0) > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unread_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGroup = (title: string, items: FeedTopic[], emptyText: string) => (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{title}</Text>
        <Text style={styles.groupCount}>{items.length}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.groupEmpty}>{emptyText}</Text>
      ) : (
        items.map(renderTopicRow)
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{selectedAgent?.display_name || 'Feed'}</Text>
          <Text style={styles.headerSub}>{selectedAgentId || 'No selected agent'}</Text>
        </View>
        <View style={styles.wsWrap}>
          <View style={[styles.wsDot, { backgroundColor: wsColor }]} />
          <Text style={styles.wsText}>{wsState}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setCreateP2POpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="git-network-outline" size={16} color="#4F46E5" />
          <Text style={styles.actionBtnText}>New P2P</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setCreateDiscussOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="people-outline" size={16} color="#4F46E5" />
          <Text style={styles.actionBtnText}>New Discuss</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setCreateTaskOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={16} color="#4F46E5" />
          <Text style={styles.actionBtnText}>General Task</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
        contentContainerStyle={styles.content}
      >
        {p2pRequests.length > 0 && (
          <View style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>Pending P2P Requests</Text>
              <Text style={styles.groupCount}>{p2pRequests.length}</Text>
            </View>
            {p2pRequests.map((r) => (
              <View key={r.id} style={styles.requestRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestTitle}>
                    {r.from_agent_id || 'Unknown'} → {r.target_agent_id || '-'}
                  </Text>
                  <Text style={styles.requestDesc} numberOfLines={1}>
                    {r.message || 'P2P request'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAcceptRequest(r.id)}
                >
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleRejectRequest(r.id)}
                >
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {renderGroup('General Tasks', grouped.generalTasks, 'No general task topics')}
        {renderGroup('P2P', grouped.p2p, 'No p2p topics')}
        {renderGroup('Discuss', grouped.discuss, 'No discuss topics')}
        {renderGroup('Subscriber', grouped.subscriber, 'No subscriber topics')}
      </ScrollView>

      <Modal
        visible={createTaskOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateTaskOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Create General Task</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Task title"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { height: 90 }]}
              placeholder="Description (optional)"
              value={newTaskDesc}
              onChangeText={setNewTaskDesc}
              multiline
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalGhostBtn}
                onPress={() => setCreateTaskOpen(false)}
              >
                <Text style={styles.modalGhostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSolidBtn,
                  (!newTaskTitle.trim() || taskCreating) && { opacity: 0.6 },
                ]}
                onPress={handleCreateGeneralTask}
                disabled={!newTaskTitle.trim() || taskCreating}
              >
                <Text style={styles.modalSolidBtnText}>
                  {taskCreating ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={createP2POpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateP2POpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Send P2P Request</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Target agent id"
              value={targetAgentId}
              onChangeText={setTargetAgentId}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalGhostBtn}
                onPress={() => setCreateP2POpen(false)}
              >
                <Text style={styles.modalGhostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSolidBtn,
                  (!targetAgentId.trim() || p2pCreating) && { opacity: 0.6 },
                ]}
                onPress={handleCreateP2PRequest}
                disabled={!targetAgentId.trim() || p2pCreating}
              >
                <Text style={styles.modalSolidBtnText}>{p2pCreating ? 'Sending...' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={createDiscussOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateDiscussOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Send Discuss Request</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Target agent id"
              value={discussTargetAgentId}
              onChangeText={setDiscussTargetAgentId}
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Discuss topic name"
              value={discussTopicName}
              onChangeText={setDiscussTopicName}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalGhostBtn}
                onPress={() => setCreateDiscussOpen(false)}
              >
                <Text style={styles.modalGhostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSolidBtn,
                  (!discussTargetAgentId.trim() || !discussTopicName.trim() || discussCreating) && {
                    opacity: 0.6,
                  },
                ]}
                onPress={handleCreateDiscussRequest}
                disabled={
                  !discussTargetAgentId.trim() || !discussTopicName.trim() || discussCreating
                }
              >
                <Text style={styles.modalSolidBtnText}>
                  {discussCreating ? 'Sending...' : 'Send'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={inviteOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Invite member to discuss</Text>
            <Text style={styles.modalHintText} numberOfLines={1}>
              Topic: {inviteTopicName}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Agent id to invite"
              value={inviteAgentId}
              onChangeText={setInviteAgentId}
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setInviteOpen(false)}>
                <Text style={styles.modalGhostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSolidBtn,
                  (!inviteAgentId.trim() || inviteCreating) && { opacity: 0.6 },
                ]}
                onPress={handleInviteMember}
                disabled={!inviteAgentId.trim() || inviteCreating}
              >
                <Text style={styles.modalSolidBtnText}>
                  {inviteCreating ? 'Inviting...' : 'Invite'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSub: { marginTop: 2, fontSize: 11, color: '#94A3B8' },
  wsWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wsDot: { width: 8, height: 8, borderRadius: 4 },
  wsText: { fontSize: 11, color: '#64748B', textTransform: 'capitalize' },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#4F46E5' },

  content: { padding: 12, gap: 12 },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  groupTitle: { fontSize: 13, fontWeight: '700', color: '#334155' },
  groupCount: {
    fontSize: 11,
    color: '#475569',
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groupEmpty: { padding: 12, fontSize: 12, color: '#94A3B8' },

  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  topicIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  topicTextWrap: { flex: 1 },
  topicTitleLine: { flexDirection: 'row', alignItems: 'center' },
  topicTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F172A', marginRight: 8 },
  topicTime: { fontSize: 11, color: '#94A3B8' },
  topicDesc: { marginTop: 2, fontSize: 12, color: '#64748B' },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  inviteBtnText: { fontSize: 11, color: '#4338CA', fontWeight: '600' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },

  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  requestTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  requestDesc: { marginTop: 2, fontSize: 12, color: '#64748B' },
  acceptBtn: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  acceptBtnText: { fontSize: 12, color: '#166534', fontWeight: '600' },
  rejectBtn: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rejectBtnText: { fontSize: 12, color: '#991B1B', fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  modalHintText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  modalGhostBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalGhostBtnText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  modalSolidBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalSolidBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
});
