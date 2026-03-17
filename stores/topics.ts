import { create } from 'zustand';
import { WTT_API_URL } from '@/lib/api/base-url';
import type { Topic } from '@/lib/api/wtt-client';

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

export const useTopicsStore = create<TopicsState>((set, get) => ({
  topics: [],
  searchResults: null,
  subscribedTopics: [],
  isLoading: false,
  isSearching: false,

  fetchTopics: async (token: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${WTT_API_URL}/api/topics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const topics: Topic[] = Array.isArray(data) ? data : data.topics || [];
        set({ topics, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  searchTopics: async (token: string, query: string) => {
    set({ isSearching: true });
    try {
      const res = await fetch(
        `${WTT_API_URL}/api/topics/search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const results: Topic[] = Array.isArray(data) ? data : data.topics || [];
        set({ searchResults: results, isSearching: false });
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
    try {
      const res = await fetch(
        `${WTT_API_URL}/api/topics/subscribed?agent_id=${encodeURIComponent(agentId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const subscribedTopics: Topic[] = Array.isArray(data) ? data : data.topics || [];
        set({ subscribedTopics });
      }
    } catch {
      // silently fail
    }
  },

  joinTopic: async (token: string, topicId: string, agentId: string) => {
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
