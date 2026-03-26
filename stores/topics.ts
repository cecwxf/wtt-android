import { create } from 'zustand';
import { WTT_API_URL } from '@/lib/api/base-url';
import type { Topic } from '@/lib/api/wtt-client';
import { useWebSocketStore } from './websocket';

interface TopicsState {
  topics: Topic[];
  searchResults: Topic[] | null;
  subscribedTopics: Topic[];
  isLoading: boolean;
  isSearching: boolean;

  fetchTopics: (token: string) => Promise<void>;
  searchTopics: (token: string, query: string) => Promise<void>;
  clearSearch: () => void;
  fetchSubscribedTopics: (token: string, agentId: string) => Promise<void>;
  joinTopic: (token: string, topicId: string, agentId: string) => Promise<void>;
  leaveTopic: (token: string, topicId: string, agentId: string) => Promise<void>;
}

function normalizeTopic(raw: Record<string, unknown>): Topic {
  const typeRaw = String(raw.type || 'discussion').toLowerCase();
  const topicType: Topic['type'] =
    typeRaw === 'broadcast' ||
    typeRaw === 'p2p' ||
    typeRaw === 'collaborative' ||
    typeRaw === 'discussion'
      ? (typeRaw as Topic['type'])
      : 'discussion';

  const visibilityRaw = String(raw.visibility || 'public').toLowerCase();
  const visibility: Topic['visibility'] = visibilityRaw === 'private' ? 'private' : 'public';

  const joinMethodRaw = String(raw.join_method || 'open').toLowerCase();
  const joinMethod: Topic['join_method'] =
    joinMethodRaw === 'invite' || joinMethodRaw === 'invite_only' ? 'invite_only' : 'open';

  const roleRaw = String(raw.my_role || '').toLowerCase();
  const myRole: Topic['my_role'] | undefined =
    roleRaw === 'owner' || roleRaw === 'admin' || roleRaw === 'member' || roleRaw === 'observer'
      ? (roleRaw as Topic['my_role'])
      : undefined;

  return {
    id: String(raw.id || ''),
    name: String(raw.name || ''),
    description: String(raw.description || ''),
    type: topicType,
    visibility,
    join_method: joinMethod,
    creator_agent_id: String(raw.creator_agent_id || ''),
    created_at: String(raw.created_at || new Date().toISOString()),
    is_active: raw.is_active === false ? false : true,
    member_count: typeof raw.member_count === 'number' ? raw.member_count : undefined,
    my_role: myRole,
  };
}

function normalizeTopics(data: unknown): Topic[] {
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { topics?: unknown[] }).topics)
      ? (data as { topics: unknown[] }).topics
      : [];

  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => normalizeTopic(x))
    .filter((x) => !!x.id);
}

async function tryWsAction<T = unknown>(
  action: 'list' | 'find' | 'subscribed' | 'join' | 'leave',
  payload?: Record<string, unknown>,
): Promise<T | null> {
  const ws = useWebSocketStore.getState();
  if (ws.wsState !== 'connected') return null;
  try {
    return await ws.sendAction<T>(action, payload);
  } catch {
    return null;
  }
}

export const useTopicsStore = create<TopicsState>((set, get) => ({
  topics: [],
  searchResults: null,
  subscribedTopics: [],
  isLoading: false,
  isSearching: false,

  fetchTopics: async (token: string) => {
    set({ isLoading: true });

    const wsData = await tryWsAction<unknown>('list', { limit: 100 });
    if (wsData !== null) {
      set({ topics: normalizeTopics(wsData), isLoading: false });
      return;
    }

    try {
      const res = await fetch(`${WTT_API_URL}/api/topics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        set({ topics: normalizeTopics(data), isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  searchTopics: async (token: string, query: string) => {
    set({ isSearching: true });

    const wsData = await tryWsAction<unknown>('find', { query });
    if (wsData !== null) {
      set({ searchResults: normalizeTopics(wsData), isSearching: false });
      return;
    }

    try {
      const res = await fetch(
        `${WTT_API_URL}/api/topics/search?query=${encodeURIComponent(query)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        set({ searchResults: normalizeTopics(data), isSearching: false });
      } else {
        set({ searchResults: [], isSearching: false });
      }
    } catch {
      set({ searchResults: [], isSearching: false });
    }
  },

  clearSearch: () => {
    set({ searchResults: null });
  },

  fetchSubscribedTopics: async (token: string, agentId: string) => {
    const wsData = await tryWsAction<unknown>('subscribed');
    if (wsData !== null) {
      set({ subscribedTopics: normalizeTopics(wsData) });
      return;
    }

    try {
      const res = await fetch(
        `${WTT_API_URL}/api/topics/subscribed?agent_id=${encodeURIComponent(agentId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        set({ subscribedTopics: normalizeTopics(data) });
      }
    } catch {
      // silently fail
    }
  },

  joinTopic: async (token: string, topicId: string, agentId: string) => {
    const wsData = await tryWsAction('join', { topic_id: topicId });
    if (wsData !== null) {
      await get().fetchSubscribedTopics(token, agentId);
      return;
    }

    const res = await fetch(
      `${WTT_API_URL}/api/topics/${topicId}/join?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to join topic' }));
      throw new Error(err.detail || 'Failed to join topic');
    }
    await get().fetchSubscribedTopics(token, agentId);
  },

  leaveTopic: async (token: string, topicId: string, agentId: string) => {
    const wsData = await tryWsAction('leave', { topic_id: topicId });
    if (wsData !== null) {
      await get().fetchSubscribedTopics(token, agentId);
      return;
    }

    const res = await fetch(
      `${WTT_API_URL}/api/topics/${topicId}/leave?agent_id=${encodeURIComponent(agentId)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to leave topic' }));
      throw new Error(err.detail || 'Failed to leave topic');
    }
    await get().fetchSubscribedTopics(token, agentId);
  },
}));
