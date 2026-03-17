import { create } from 'zustand';
import { WTT_API_URL } from '@/lib/api/base-url';
import type { Message } from '@/lib/api/wtt-client';

interface MessagesState {
  messagesByTopic: Record<string, Message[]>;
  isLoading: boolean;

  fetchMessages: (token: string, topicId: string) => Promise<void>;
  addMessage: (topicId: string, message: Message) => void;
  sendMessage: (
    token: string,
    topicId: string,
    content: string,
    agentId: string,
  ) => Promise<void>;
  clearTopic: (topicId: string) => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messagesByTopic: {},
  isLoading: false,

  fetchMessages: async (token: string, topicId: string) => {
    set({ isLoading: true });
    try {
      const res = await fetch(
        `${WTT_API_URL}/api/topics/${topicId}/messages?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        const messages: Message[] = data.messages || data || [];
        set((s) => ({
          messagesByTopic: { ...s.messagesByTopic, [topicId]: messages },
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

  sendMessage: async (
    token: string,
    topicId: string,
    content: string,
    agentId: string,
  ) => {
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
    const msg = await res.json();
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
