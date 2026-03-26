import { create } from 'zustand';
import { WTT_API_URL } from '@/lib/api/base-url';
import type { Message } from '@/lib/api/wtt-client';
import { useWebSocketStore } from './websocket';

interface MessagesState {
  messagesByTopic: Record<string, Message[]>;
  isLoading: boolean;

  fetchMessages: (token: string, topicId: string) => Promise<void>;
  addMessage: (topicId: string, message: Message) => void;
  sendMessage: (token: string, topicId: string, content: string, agentId: string) => Promise<void>;
  clearTopic: (topicId: string) => void;
}

function normalizeMessage(topicId: string, raw: Record<string, unknown>): Message {
  return {
    message_id: String(raw.message_id || raw.id || ''),
    topic_id: String(raw.topic_id || topicId),
    sender_id: String(raw.sender_id || ''),
    sender_type: String(raw.sender_type || 'agent').toLowerCase() === 'human' ? 'human' : 'agent',
    source: String(raw.source || 'topic').toLowerCase() === 'im' ? 'im' : 'topic',
    content_type: String(raw.content_type || 'text'),
    semantic_type: String(raw.semantic_type || 'post'),
    content: String(raw.content || ''),
    timestamp: String(raw.timestamp || raw.created_at || new Date().toISOString()),
    reply_to: raw.reply_to ? String(raw.reply_to) : undefined,
  };
}

function normalizeMessageList(topicId: string, data: unknown): Message[] {
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { messages?: unknown[] }).messages)
      ? (data as { messages: unknown[] }).messages
      : [];

  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => normalizeMessage(topicId, x))
    .filter((x) => !!x.message_id);
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messagesByTopic: {},
  isLoading: false,

  fetchMessages: async (token: string, topicId: string) => {
    set({ isLoading: true });

    try {
      const ws = useWebSocketStore.getState();
      if (ws.wsState === 'connected') {
        const wsData = await ws.sendAction<unknown>('history', { topic_id: topicId, limit: 50 });
        if (wsData !== null) {
          set((s) => ({
            messagesByTopic: {
              ...s.messagesByTopic,
              [topicId]: normalizeMessageList(topicId, wsData),
            },
            isLoading: false,
          }));
          return;
        }
      }
    } catch {
      // fallback to REST
    }

    try {
      const res = await fetch(`${WTT_API_URL}/api/topics/${topicId}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        set((s) => ({
          messagesByTopic: { ...s.messagesByTopic, [topicId]: normalizeMessageList(topicId, data) },
          isLoading: false,
        }));
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  addMessage: (topicId: string, message: Message) => {
    set((s) => {
      const existing = s.messagesByTopic[topicId] || [];
      if (existing.some((m) => m.message_id === message.message_id)) return s;
      return {
        messagesByTopic: {
          ...s.messagesByTopic,
          [topicId]: [...existing, message],
        },
      };
    });
  },

  sendMessage: async (token: string, topicId: string, content: string, agentId: string) => {
    try {
      const ws = useWebSocketStore.getState();
      if (ws.wsState === 'connected') {
        const wsResult = await ws.sendAction<unknown>('publish', {
          topic_id: topicId,
          content,
          content_type: 'text',
          semantic_type: 'post',
        });
        if (wsResult !== null) {
          const msg = normalizeMessage(topicId, wsResult as Record<string, unknown>);
          get().addMessage(topicId, msg);
          return;
        }
      }
    } catch {
      // fallback to REST
    }

    const res = await fetch(`${WTT_API_URL}/api/topics/${topicId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        sender_id: agentId,
        content_type: 'text',
      }),
    });
    if (!res.ok) {
      throw new Error('Failed to send message');
    }
    const msg = normalizeMessage(topicId, await res.json());
    get().addMessage(topicId, msg);
  },

  clearTopic: (topicId: string) => {
    set((s) => {
      const copy = { ...s.messagesByTopic };
      delete copy[topicId];
      return { messagesByTopic: copy };
    });
  },
}));
