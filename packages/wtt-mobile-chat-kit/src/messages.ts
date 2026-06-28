import { mergeMobileHistory } from './history';
import {
  mobileSlashMetadataPayload,
  type MobileSlashSendOptions,
} from './slash-commands';

export type MobileSendMessageOptions = {
  metadata?: Record<string, unknown>;
  slash?: MobileSlashSendOptions;
};

export type MobileTopicMessage = {
  message_id: string;
  topic_id: string;
  sender_id: string;
  sender_type: 'human' | 'agent';
  source: 'im' | 'topic';
  content_type: string;
  semantic_type: string;
  content: string;
  timestamp: string;
  reply_to?: string;
};

export type MobileMessagesState<TMessage extends MobileTopicMessage = MobileTopicMessage> = {
  messagesByTopic: Record<string, TMessage[]>;
  isLoading: boolean;
  fetchMessages: (token: string, topicId: string) => Promise<void>;
  addMessage: (topicId: string, message: TMessage) => void;
  sendMessage: (
    token: string,
    topicId: string,
    content: string,
    agentId: string,
    options?: MobileSendMessageOptions,
  ) => Promise<void>;
  clearTopic: (topicId: string) => void;
};

export type MobileWebSocketBridge = {
  wsState?: string;
  sendAction?: <T = unknown>(
    action: any,
    payload?: Record<string, unknown>,
  ) => Promise<T | null>;
};

export type MobileMessagesStoreDeps<TMessage extends MobileTopicMessage = MobileTopicMessage> = {
  baseUrl: string;
  historyLimit?: number;
  getWebSocket?: () => MobileWebSocketBridge | null | undefined;
  preferWsPublish?: boolean;
  restHistoryPath?: (topicId: string, limit: number) => string;
  restPublishPath?: (topicId: string, agentId: string) => string;
  restPublishPayload?: (
    content: string,
    agentId: string,
    options?: MobileSendMessageOptions,
  ) => Record<string, unknown>;
  onIncomingMessage?: (message: TMessage) => void;
};

type StoreSet<TMessage extends MobileTopicMessage> = (
  partial:
    | Partial<MobileMessagesState<TMessage>>
    | ((state: MobileMessagesState<TMessage>) => Partial<MobileMessagesState<TMessage>>),
) => void;

type StoreGet<TMessage extends MobileTopicMessage> = () => MobileMessagesState<TMessage>;

export function normalizeMobileTopicMessage<TMessage extends MobileTopicMessage = MobileTopicMessage>(
  topicId: string,
  raw: Record<string, unknown>,
) {
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
  } as TMessage;
}

export function normalizeMobileTopicMessageList<
  TMessage extends MobileTopicMessage = MobileTopicMessage,
>(topicId: string, data: unknown) {
  const arr = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { messages?: unknown[] }).messages)
      ? (data as { messages: unknown[] }).messages
      : [];

  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => normalizeMobileTopicMessage<TMessage>(topicId, x))
    .filter((x) => !!x.message_id);
}

export function mobileTopicPublishPath(topicId: string, agentId: string) {
  return `/topics/${encodeURIComponent(topicId)}/messages?agent_id=${encodeURIComponent(agentId)}`;
}

export function mobileHumanTopicPublishPayload(content: string, options?: MobileSendMessageOptions) {
  const metadata = {
    ...(options?.metadata || {}),
    ...(mobileSlashMetadataPayload(options?.slash) || {}),
  };
  return {
    content,
    content_type: 'text',
    semantic_type: 'post',
    sender_type: 'HUMAN',
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };
}

function defaultHistoryPath(topicId: string, limit: number) {
  return `/topics/${encodeURIComponent(topicId)}/messages?limit=${encodeURIComponent(String(limit))}`;
}

function legacyPublishPayload(content: string, agentId: string) {
  return {
    content,
    sender_id: agentId,
    content_type: 'text',
  };
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function notifyNewMessages<TMessage extends MobileTopicMessage>(
  previous: TMessage[] | undefined,
  next: TMessage[],
  onIncomingMessage?: (message: TMessage) => void,
) {
  if (!onIncomingMessage || !next.length) return;
  const previousIds = new Set((previous || []).map((message) => message.message_id));
  for (const message of next) {
    if (!previousIds.has(message.message_id)) onIncomingMessage(message);
  }
}

export function createMobileMessagesStoreInitializer<
  TMessage extends MobileTopicMessage = MobileTopicMessage,
>(deps: MobileMessagesStoreDeps<TMessage>) {
  const historyLimit = deps.historyLimit ?? 50;
  const restHistoryPath = deps.restHistoryPath || defaultHistoryPath;
  const restPublishPath =
    deps.restPublishPath ||
    ((topicId: string) => `/topics/${encodeURIComponent(topicId)}/messages`);
  const restPublishPayload = deps.restPublishPayload || legacyPublishPayload;

  return (
    set: StoreSet<TMessage>,
    get: StoreGet<TMessage>,
  ): MobileMessagesState<TMessage> => ({
    messagesByTopic: {},
    isLoading: false,

    fetchMessages: async (token: string, topicId: string) => {
      set({ isLoading: true });

      try {
        const ws = deps.getWebSocket?.();
        if (ws?.wsState === 'connected' && ws.sendAction) {
          const wsData = await ws.sendAction<unknown>('history', {
            topic_id: topicId,
            limit: historyLimit,
          });
          if (wsData !== null) {
            const previous = get().messagesByTopic[topicId];
            const next = normalizeMobileTopicMessageList<TMessage>(topicId, wsData);
            if (!next.length) {
              // Some runtimes return an empty action response while durable REST history exists.
              throw new Error('empty ws history');
            }
            const merged = mergeMobileHistory(previous, next);
            set((state) => ({
              messagesByTopic: { ...state.messagesByTopic, [topicId]: merged },
              isLoading: false,
            }));
            notifyNewMessages(previous, merged, deps.onIncomingMessage);
            return;
          }
        }
      } catch {
        // fallback to REST
      }

      try {
        const res = await fetch(`${deps.baseUrl}${restHistoryPath(topicId, historyLimit)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const previous = get().messagesByTopic[topicId];
          const next = normalizeMobileTopicMessageList<TMessage>(topicId, await res.json());
          const merged = mergeMobileHistory(previous, next);
          set((state) => ({
            messagesByTopic: { ...state.messagesByTopic, [topicId]: merged },
            isLoading: false,
          }));
          notifyNewMessages(previous, merged, deps.onIncomingMessage);
        } else {
          set({ isLoading: false });
        }
      } catch {
        set({ isLoading: false });
      }
    },

    addMessage: (topicId: string, message: TMessage) => {
      let added = false;
      set((state) => {
        const existing = state.messagesByTopic[topicId] || [];
        if (existing.some((m) => m.message_id === message.message_id)) return state;
        added = true;
        return {
          messagesByTopic: {
            ...state.messagesByTopic,
            [topicId]: [...existing, message],
          },
        };
      });
      if (added) deps.onIncomingMessage?.(message);
    },

    sendMessage: async (
      token: string,
      topicId: string,
      content: string,
      agentId: string,
      options?: MobileSendMessageOptions,
    ) => {
      const metadata = {
        ...(options?.metadata || {}),
        ...(mobileSlashMetadataPayload(options?.slash) || {}),
      };
      if (deps.preferWsPublish) {
        try {
          const ws = deps.getWebSocket?.();
          if (ws?.wsState === 'connected' && ws.sendAction) {
            const wsResult = await ws.sendAction<unknown>('publish', {
              topic_id: topicId,
              content,
              content_type: 'text',
              semantic_type: 'post',
              ...(Object.keys(metadata).length ? { metadata } : {}),
            });
            if (wsResult !== null) {
              get().addMessage(
                topicId,
                normalizeMobileTopicMessage<TMessage>(
                  topicId,
                  wsResult as Record<string, unknown>,
                ),
              );
              return;
            }
          }
        } catch {
          // fallback to REST
        }
      }

      const res = await fetch(`${deps.baseUrl}${restPublishPath(topicId, agentId)}`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(restPublishPayload(content, agentId, options)),
      });
      if (!res.ok) throw new Error('Failed to send message');
      get().addMessage(topicId, normalizeMobileTopicMessage<TMessage>(topicId, await res.json()));
    },

    clearTopic: (topicId: string) => {
      set((state) => {
        const copy = { ...state.messagesByTopic };
        delete copy[topicId];
        return { messagesByTopic: copy };
      });
    },
  });
}
