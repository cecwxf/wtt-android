import { create } from 'zustand';
import {
  createMobileMessagesStoreInitializer,
  mobileHumanTopicPublishPayload,
  mobileTopicPublishPath,
  type MobileMessagesState,
} from '@wtt/mobile-chat-kit/messages';
import { WTT_API_URL } from '@/lib/api/base-url';
import type { Message } from '@/lib/api/wtt-client';
import { useWebSocketStore } from './websocket';

export const useMessagesStore = create<MobileMessagesState<Message>>(
  createMobileMessagesStoreInitializer<Message>({
    baseUrl: WTT_API_URL,
    preferWsPublish: true,
    getWebSocket: () => useWebSocketStore.getState(),
    restPublishPath: mobileTopicPublishPath,
    restPublishPayload: (content, _agentId, options) => mobileHumanTopicPublishPayload(content, options),
  }),
);
