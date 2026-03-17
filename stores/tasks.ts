import { create } from 'zustand';
import { WTT_API_URL } from '@/lib/api/base-url';

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

  fetchTasks: (token: string, agentId: string) => Promise<void>;
  createTask: (
    token: string,
    data: {
      title: string;
      task_type?: string;
      owner_agent_id?: string;
      description?: string;
    },
  ) => Promise<void>;
  updateTaskStatus: (
    token: string,
    taskId: string,
    status: TaskItem['status'],
  ) => Promise<void>;
  deleteTask: (token: string, taskId: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  _lastToken: null,
  _lastAgentId: null,

  fetchTasks: async (token: string, agentId: string) => {
    set({ isLoading: true, error: null, _lastToken: token, _lastAgentId: agentId });
    try {
      const res = await fetch(
        `${WTT_API_URL}/api/tasks?owner_agent_id=${agentId}&limit=500`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const tasks: TaskItem[] = data.tasks || data || [];
        set({ tasks, isLoading: false });
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to fetch tasks' }));
        set({ error: err.detail || 'Failed to fetch tasks', isLoading: false });
      }
    } catch {
      set({ error: 'Network error', isLoading: false });
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
        const err = await res.json().catch(() => ({ detail: 'Failed to create task' }));
        throw new Error(err.detail || 'Failed to create task');
      }
      const { _lastToken, _lastAgentId } = get();
      if (_lastToken && _lastAgentId) {
        await get().fetchTasks(_lastToken, _lastAgentId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create task';
      set({ error: msg });
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
        const err = await res.json().catch(() => ({ detail: 'Failed to update task' }));
        throw new Error(err.detail || 'Failed to update task');
      }
      const { _lastToken, _lastAgentId } = get();
      if (_lastToken && _lastAgentId) {
        await get().fetchTasks(_lastToken, _lastAgentId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update task';
      set({ error: msg });
    }
  },

  deleteTask: async (token, taskId) => {
    set({ error: null });
    try {
      const res = await fetch(`${WTT_API_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to delete task' }));
        throw new Error(err.detail || 'Failed to delete task');
      }
      const { _lastToken, _lastAgentId } = get();
      if (_lastToken && _lastAgentId) {
        await get().fetchTasks(_lastToken, _lastAgentId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete task';
      set({ error: msg });
    }
  },
}));
