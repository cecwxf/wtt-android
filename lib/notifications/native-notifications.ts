import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
import { AppState, Platform } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import type { ChatNotice, NotificationPreferences, NotificationSettings } from './protocol';

const defaults: NotificationPreferences = { enabled: false, sound: false, preview: false };
const preferencesFile = `${FileSystem.documentDirectory}wtt-notification-preferences.json`;
const seen = new Map<string, number>();
let writing: Promise<unknown> = Promise.resolve();
const currentUser = () => useAuthStore.getState().user?.id || useAuthStore.getState().user?.user_id || null;
const owned = (notice: Notifications.Notification) => notice.request.content.data?.kind === 'wtt-chat';
const allowed = (userId: string, current: () => boolean) => {
  if (!current() || currentUser() !== userId || !useAuthStore.getState().token) throw new Error('Notification account changed');
};

async function readAll(): Promise<Record<string, NotificationPreferences>> {
  if (!FileSystem.documentDirectory) throw new Error('Application storage unavailable');
  const info = await FileSystem.getInfoAsync(preferencesFile);
  if (!info.exists) return {};
  if (info.isDirectory || info.size > 128 * 1024) throw new Error('Invalid notification settings');
  const value = JSON.parse(await FileSystem.readAsStringAsync(preferencesFile));
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 128) throw new Error('Invalid notification settings');
  return value;
}

export async function notificationSettings(userId: string, current: () => boolean): Promise<NotificationSettings> {
  allowed(userId, current);
  const value = (await readAll())[userId];
  const permissions = await Notifications.getPermissionsAsync();
  allowed(userId, current);
  const saved = value && typeof value.enabled === 'boolean' && typeof value.sound === 'boolean' && typeof value.preview === 'boolean' ? value : defaults;
  return { enabled: saved.enabled, sound: saved.sound, preview: saved.preview, granted: permissions.granted };
}

export async function dismissAccountNotifications(userId?: string) {
  const notifications = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(notifications.filter(notice => owned(notice) && (!userId || notice.request.content.data.userId === userId))
    .map(notice => Notifications.dismissNotificationAsync(notice.request.identifier)));
}

export async function saveNotificationSettings(userId: string, value: NotificationPreferences, current: () => boolean): Promise<NotificationSettings> {
  const operation = writing.then(async () => {
    allowed(userId, current);
    if (value.enabled && Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('wtt-chat-silent', { name: 'WTT Messages', importance: Notifications.AndroidImportance.DEFAULT, sound: null });
      await Notifications.setNotificationChannelAsync('wtt-chat-sound', { name: 'WTT Messages with Sound', importance: Notifications.AndroidImportance.DEFAULT, sound: 'default' });
    }
    let permissions = await Notifications.getPermissionsAsync();
    allowed(userId, current);
    if (value.enabled && !permissions.granted && permissions.canAskAgain) {
      permissions = await Notifications.requestPermissionsAsync();
    }
    allowed(userId, current);
    const all = await readAll();
    const saved = Object.fromEntries(Object.entries(all).filter(([key]) => key !== userId).slice(-127));
    const temporary = `${preferencesFile}.tmp`;
    try {
      await FileSystem.writeAsStringAsync(temporary, JSON.stringify({ ...saved, [userId]: value }));
      allowed(userId, current);
      await FileSystem.moveAsync({ from: temporary, to: preferencesFile });
    } finally { await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => {}); }
    if (!value.enabled) await dismissAccountNotifications(userId);
    allowed(userId, current);
    return { ...value, granted: permissions.granted };
  });
  writing = operation.catch(() => {});
  return operation;
}

export async function showChatNotification(value: ChatNotice, current: () => boolean) {
  const preferences = await notificationSettings(value.userId, current);
  if (!preferences.enabled || !preferences.granted || (AppState.currentState === 'active' && value.focused)) return false;
  allowed(value.userId, current);
  const now = Date.now();
  for (const [key, time] of seen) if (now - time > 10 * 60 * 1000) seen.delete(key);
  const key = `${value.userId}:${value.messageId}`;
  if (seen.has(key)) return false;
  seen.set(key, now);
  if (seen.size > 1000) seen.delete(seen.keys().next().value!);
  const existing = (await Notifications.getPresentedNotificationsAsync()).filter(owned);
  for (const notice of existing.slice(0, Math.max(0, existing.length - 19))) await Notifications.dismissNotificationAsync(notice.request.identifier);
  allowed(value.userId, current);
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: preferences.preview ? value.title || 'WTT' : 'WTT',
      body: preferences.preview ? value.body : 'Agent 有新回复 / New agent reply',
      sound: preferences.sound ? 'default' : false,
      data: { kind: 'wtt-chat', userId: value.userId, messageId: value.messageId, agentId: value.agentId, topicId: value.topicId },
    },
    trigger: Platform.OS === 'android' ? { channelId: preferences.sound ? 'wtt-chat-sound' : 'wtt-chat-silent' } : null,
  });
  if (!current() || currentUser() !== value.userId) {
    await Notifications.dismissNotificationAsync(identifier);
    return false;
  }
  return true;
}

Notifications.setNotificationHandler({
  handleNotification: async notice => ({
    shouldShowAlert: owned(notice) && currentUser() === notice.request.content.data?.userId,
    shouldPlaySound: Boolean(notice.request.content.sound),
    shouldSetBadge: false,
  }),
});

export function observeChatNotifications(navigate: (agentId: string, topicId: string) => void) {
  let opened = '';
  const open = (response: Notifications.NotificationResponse | null) => {
    if (!response || !owned(response.notification)) return;
    const data = response.notification.request.content.data;
    if (data.userId !== currentUser() || !useAuthStore.getState().token
      || typeof data.agentId !== 'string' || !/^[\w-]{1,200}$/.test(data.agentId)
      || typeof data.topicId !== 'string' || !/^[\w-]{1,200}$/.test(data.topicId)) return;
    if (opened === response.notification.request.identifier) return;
    opened = response.notification.request.identifier;
    navigate(data.agentId, data.topicId);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    void Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
  };
  const listener = Notifications.addNotificationResponseReceivedListener(open);
  void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  void Notifications.getPresentedNotificationsAsync().then(notices => Promise.all(notices
    .filter(notice => owned(notice) && notice.request.content.data.userId !== currentUser())
    .map(notice => Notifications.dismissNotificationAsync(notice.request.identifier)))).catch(() => {});
  const offAccount = useAuthStore.subscribe((next, previous) => {
    const before = previous.user?.id || previous.user?.user_id;
    const after = next.user?.id || next.user?.user_id;
    if (before !== after || (previous.token && !next.token)) {
      seen.clear();
      if (before) void dismissAccountNotifications(before).catch(() => {});
    }
  });
  return () => { listener.remove(); offAccount(); };
}
