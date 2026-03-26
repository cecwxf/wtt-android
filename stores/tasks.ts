import { create } from 'zustand';
import { WTT_API_URL } from '@/lib/api/base-url';
import type { Message } from '@/lib/api/wtt-client';

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  task_type: string;
  task_mode?: string;
  pipeline_id?: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'todo' | 'doing' | 'review' | 'done' | 'blocked';
  owner_agent_id?: string;
  runner_agent_id?: string;
  created_by?: string;
  topic_id?: string;
  acceptance?: string;
  exec_mode?: string;
  due_at?: string;
  estimate_hours?: number;
  dependencies?: string;
  notes?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  updated_at?: string;
}

interface TasksState {
  tasks: TaskItem[];
  isLoading: boolean;
  error: string | null;
  _lastToken: string | null;
  _lastAgentId: string | null;

  timelineByTask: Record<string, Message[]>;
  timelineLoadingTaskId: string | null;

  fetchTasks: (token: string, agentId: string) => Promise<void>;
  refreshLast: () => Promise<void>;
  createTask: (
    token: string,
    data: {
      title: string;
      task_type?: string;
      owner_agent_id?: string;
      description?: string;
      status?: string;
      runner_agent_id?: string;
    },
  ) => Promise<TaskItem | null>;
  updateTaskStatus: (token: string, taskId: string, status: TaskItem['status']) => Promise<void>;
  deleteTask: (token: string, taskId: string, actingAgentId?: string) => Promise<void>;

  runTask: (token: string, task: TaskItem, actorId: string) => Promise<void>;
  reviewTask: (
    token: string,
    taskId: string,
    action: 'approve' | 'reject' | 'block',
    reviewer: string,
  ) => Promise<void>;
  fetchTaskTimeline: (
    token: string,
    taskId: string,
    topicId?: string,
    agentId?: string,
  ) => Promise<void>;
  sendTaskChat: (token: string, task: TaskItem, senderId: string, message: string) => Promise<void>;
}

async function parseErr(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({ detail: fallback }));
  return data.detail || fallback;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  _lastToken: null,
  _lastAgentId: null,

  timelineByTask: {},
  timelineLoadingTaskId: null,

  fetchTasks: async (token: string, agentId: string) => {
    set({ isLoading: true, error: null, _lastToken: token, _lastAgentId: agentId });
    try {
      const res = await fetch(
        `${WTT_API_URL}/api/tasks?owner_agent_id=${encodeURIComponent(agentId)}&limit=500`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const tasks: TaskItem[] = data.tasks || data || [];
        set({ tasks, isLoading: false });
      } else {
        const msg = await parseErr(res, 'Failed to fetch tasks');
        set({ error: msg, isLoading: false });
      }
    } catch {
      set({ error: 'Network error', isLoading: false });
    }
  },

  refreshLast: async () => {
    const { _lastToken, _lastAgentId } = get();
    if (_lastToken && _lastAgentId) {
      await get().fetchTasks(_lastToken, _lastAgentId);
    }
  },

  createTask: async (token, data) => {
    set({ error: null });
    try {
      const res = await fetch(`${WTT_API_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const msg = await parseErr(res, 'Failed to create task');
        throw new Error(msg);
      }
      const created = (await res.json()) as TaskItem;
      await get().refreshLast();
      return created;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create task';
      set({ error: msg });
      return null;
    }
  },

  updateTaskStatus: async (token, taskId, status) => {
    set({ error: null });
    try {
      const res = await fetch(`${WTT_API_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const msg = await parseErr(res, 'Failed to update task');
        throw new Error(msg);
      }
      await get().refreshLast();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update task';
      set({ error: msg });
    }
  },

  deleteTask: async (token, taskId, actingAgentId) => {
    set({ error: null });
    try {
      const params = new URLSearchParams();
      if (actingAgentId) params.set('acting_as_agent_id', actingAgentId);
      params.set('delete_topic', 'true');
      const url = `${WTT_API_URL}/api/tasks/${taskId}?${params.toString()}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await parseErr(res, 'Failed to delete task');
        throw new Error(msg);
      }
      await get().refreshLast();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete task';
      set({ error: msg });
    }
  },

  runTask: async (token, task, actorId) => {
    set({ error: null });
    try {
      const res = await fetch(`${WTT_API_URL}/api/tasks/${task.id}/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trigger_agent_id: actorId,
          runner_agent_id: task.runner_agent_id || task.owner_agent_id || actorId,
        }),
      });
      if (!res.ok) {
        const msg = await parseErr(res, 'Failed to run task');
        throw new Error(msg);
      }
      await get().refreshLast();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to run task';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  reviewTask: async (token, taskId, action, reviewer) => {
    set({ error: null });
    try {
      const res = await fetch(`${WTT_API_URL}/api/tasks/${taskId}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, reviewer, comment: '' }),
      });
      if (!res.ok) {
        const msg = await parseErr(res, 'Failed to review task');
        throw new Error(msg);
      }
      await get().refreshLast();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to review task';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  fetchTaskTimeline: async (token, taskId, topicId, agentId) => {
    if (!topicId) {
      set((s) => ({
        timelineByTask: { ...s.timelineByTask, [taskId]: [] },
        timelineLoadingTaskId: null,
      }));
      return;
    }
    set({ timelineLoadingTaskId: taskId });
    try {
      const query = new URLSearchParams({ limit: '200' });
      if (agentId) query.set('agent_id', agentId);
      const res = await fetch(`${WTT_API_URL}/api/topics/${topicId}/messages?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await parseErr(res, 'Failed to fetch timeline');
        throw new Error(msg);
      }
      const data = await res.json();
      const messages = (data.messages || data || []) as Message[];
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      set((s) => ({
        timelineByTask: { ...s.timelineByTask, [taskId]: messages },
        timelineLoadingTaskId: null,
      }));
    } catch {
      set({ timelineLoadingTaskId: null });
    }
  },

  sendTaskChat: async (token, task, senderId, message) => {
    const text = message.trim();
    if (!text) return;

    set({ error: null });

    const autoRun = task.status === 'todo';
    const sendByTaskLane = async () => {
      const resp = await fetch(`${WTT_API_URL}/api/tasks/${task.id}/chat/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          sender_id: senderId,
          auto_run: autoRun,
        }),
      });
      if (!resp.ok) {
        const msg = await parseErr(resp, 'Failed to send task chat');
        throw new Error(msg);
      }
    };

    const sendByTopicLane = async () => {
      if (!task.topic_id) {
        throw new Error('Task has no topic');
      }
      const url = `${WTT_API_URL}/api/topics/${task.topic_id}/messages?agent_id=${encodeURIComponent(senderId)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: text,
          sender_id: senderId,
          content_type: 'text',
          semantic_type: 'post',
        }),
      });
      if (!resp.ok) {
        const msg = await parseErr(resp, 'Failed to send topic message');
        throw new Error(msg);
      }
    };

    try {
      try {
        await sendByTaskLane();
      } catch {
        await sendByTopicLane();
      }
      await get().refreshLast();
      await get().fetchTaskTimeline(token, task.id, task.topic_id, senderId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send task message';
      set({ error: msg });
      throw new Error(msg);
    }
  },
}));
