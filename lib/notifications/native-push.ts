import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { WTT_API_URL } from '@/lib/api/base-url';

export type PushStatus = 'off' | 'not_configured' | 'registered' | 'unavailable';
type Identity = { device_id: string; device_secret: string };
type Account = { id: string; token: string };
const identityFile = `${FileSystem.documentDirectory}wtt-push-installation.json`;
let serial: Promise<unknown> = Promise.resolve();
let tokenAttempt: Promise<Notifications.ExpoPushToken> | null = null;
let status: { userId: string; value: PushStatus } | null = null;
let lastSync = 0;

function account(): Account | null {
  const state = useAuthStore.getState();
  const id = state.user?.id || state.user?.user_id;
  return id && state.token ? { id, token: state.token } : null;
}
const current = (value: Account) => account()?.id === value.id && account()?.token === value.token;
export const pushStatus = (userId: string): PushStatus => status?.userId === userId ? status.value : 'off';

async function identity(create = false): Promise<Identity | null> {
  if (!FileSystem.documentDirectory) throw new Error('Application storage unavailable');
  const info = await FileSystem.getInfoAsync(identityFile);
  if (info.exists) {
    if (info.isDirectory || info.size > 4096) throw new Error('Invalid notification installation');
    const value = JSON.parse(await FileSystem.readAsStringAsync(identityFile));
    if (!/^[a-f0-9-]{36}$/.test(value.device_id) || !/^[a-f0-9]{64}$/.test(value.device_secret)) throw new Error('Invalid notification installation');
    return { device_id: value.device_id, device_secret: value.device_secret };
  }
  if (!create) return null;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const value = { device_id: Crypto.randomUUID(), device_secret: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') };
  await FileSystem.writeAsStringAsync(identityFile, JSON.stringify(value));
  return value;
}

async function request(owner: Account, path: string, method = 'GET', body?: unknown) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 8000);
  try {
    const response = await fetch(`${WTT_API_URL}/mobile/push/${path}`, { method,
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: abort.signal, redirect: 'error' });
    if (response.status === 404 || response.status === 503) return { enabled: false };
    if (!response.ok) throw new Error('Push registration unavailable');
    const raw = await response.text();
    if (raw.length > 16384) throw new Error('Invalid push registration response');
    return JSON.parse(raw) as { enabled?: boolean; project_id?: string; ok?: boolean };
  } finally { clearTimeout(timer); }
}

async function revoke(owner: Account) {
  const device = await identity();
  if (device) await request(owner, 'devices/revoke', 'POST', device);
}

async function boundedToken(projectId: string) {
  if (!tokenAttempt) {
    tokenAttempt = Notifications.getExpoPushTokenAsync({ projectId });
    void tokenAttempt.finally(() => { tokenAttempt = null; }).catch(() => {});
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([tokenAttempt, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Push token unavailable')), 25000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

export function syncPush(preferences: { enabled: boolean; sound: boolean }, force = false): Promise<PushStatus> {
  const owner = account();
  if (!owner) return Promise.resolve('off');
  if (!force && Date.now() - lastSync < 60000) return Promise.resolve(pushStatus(owner.id));
  lastSync = Date.now();
  const operation = serial.catch(() => {}).then(async () => {
    if (!current(owner)) return 'off' as const;
    try {
      const permission = await Notifications.getPermissionsAsync();
      if (!current(owner)) return 'off' as const;
      if (!preferences.enabled || !permission.granted) {
        await revoke(owner);
        if (current(owner)) status = { userId: owner.id, value: 'off' };
        return 'off' as const;
      }
      const capability = await request(owner, 'capabilities');
      if (!current(owner)) return 'off' as const;
      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      if (!capability.enabled || !projectId || capability.project_id !== projectId || !['android', 'ios'].includes(Platform.OS)) {
        status = { userId: owner.id, value: 'not_configured' };
        return 'not_configured' as const;
      }
      const pushToken = await boundedToken(projectId);
      if (!current(owner)) return 'off' as const;
      const device = await identity(true);
      if (!current(owner)) return 'off' as const;
      const registered = await request(owner, 'devices', 'PUT', { ...device, token: pushToken.data,
        project_id: projectId, platform: Platform.OS, enabled: true, sound: preferences.sound });
      if (!current(owner)) { await revoke(owner); return 'off' as const; }
      const value: PushStatus = registered.ok ? 'registered' : 'not_configured';
      status = { userId: owner.id, value };
      return value;
    } catch {
      if (current(owner)) status = { userId: owner.id, value: 'unavailable' };
      return 'unavailable' as const;
    }
  });
  serial = operation;
  return operation;
}

export function observePush(preferences: (userId: string) => Promise<{ enabled: boolean; sound: boolean }>) {
  let active = true;
  const refresh = (force = false) => {
    const owner = account();
    if (active && owner) void preferences(owner.id).then(value => {
      if (active && current(owner)) return syncPush(value, force);
    }).catch(() => {});
  };
  const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
  const tokenListener = Notifications.addPushTokenListener(() => refresh(true));
  const offAccount = useAuthStore.subscribe((next, previous) => {
    const before = previous.user?.id || previous.user?.user_id;
    const after = next.user?.id || next.user?.user_id;
    if (before !== after || previous.token !== next.token) {
      status = null; lastSync = 0;
      if (before && previous.token) {
        const owner = { id: before, token: previous.token };
        serial = serial.catch(() => {}).then(() => revoke(owner)).catch(() => {});
      }
      refresh(true);
    }
  });
  refresh();
  return () => { active = false; subscription.remove(); tokenListener.remove(); offAccount(); };
}
