import { create } from 'zustand';
import {
  WebSocketManager,
  type WsMessage,
  type WsState,
  type WsAction,
} from '@/lib/ws/WebSocketManager';
import { useMessagesStore } from './messages';
import { useTasksStore } from './tasks';
import type { Message } from '@/lib/api/wtt-client';

interface WebSocketState {
  wsState: WsState;
  _manager: WebSocketManager | null;

  initialize: (url: string, token: string) => void;
  disconnect: () => void;
  sendAction: <T = unknown>(
    action: WsAction,
    payload?: Record<string, unknown>,
  ) => Promise<T | null>;
  updateToken: (token: string) => void;
}

function wsMessageToMessage(m: NonNullable<WsMessage['message']>): Message {
  return {
    message_id: m.id,
    topic_id: m.topic_id,
    sender_id: m.sender_id,
    sender_type: (m.sender_type as 'human' | 'agent') || 'agent',
    source: 'topic',
    content_type: m.content_type || 'text',
    semantic_type: m.semantic_type || 'post',
    content: m.content,
    timestamp: m.created_at,
  };
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  wsState: 'disconnected',
  _manager: null,

  initialize: (url: string, token: string) => {
    const existing = get()._manager;
    if (existing) existing.destroy();

    const manager = new WebSocketManager({
      url,
      token,
      onMessage: (msg: WsMessage) => {
        // Real-time incoming message
        if (msg.message) {
          const converted = wsMessageToMessage(msg.message);
          useMessagesStore.getState().addMessage(converted.topic_id, converted);
        }
        // Task status changes trigger a refresh in the tasks store
        if (msg.type === 'task_status') {
          useTasksStore
            .getState()
            .refreshLast()
            .catch(() => {});
        }
      },
      onStateChange: (state: WsState) => {
        set({ wsState: state });
      },
    });

    manager.connect();
    set({ _manager: manager, wsState: 'connecting' });
  },

  disconnect: () => {
    get()._manager?.destroy();
    set({ _manager: null, wsState: 'disconnected' });
  },

  sendAction: async <T = unknown>(
    action: WsAction,
    payload?: Record<string, unknown>,
  ): Promise<T | null> => {
    const manager = get()._manager;
    if (!manager) return null;
    return manager.sendAction<T>(action, payload);
  },

  updateToken: (token: string) => {
    get()._manager?.updateToken(token);
  },
}));
