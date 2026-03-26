import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoryFallback = new Map<string, string>();

function hasSecureStoreApi() {
  return typeof (SecureStore as { getItemAsync?: unknown }).getItemAsync === 'function';
}

function getWebStorage() {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (hasSecureStoreApi()) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // fallback below
    }
  }

  const web = getWebStorage();
  if (web) {
    const value = web.getItem(key);
    if (value !== null) return value;
  }

  return memoryFallback.get(key) ?? null;
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (hasSecureStoreApi()) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // fallback below
    }
  }

  const web = getWebStorage();
  if (web) {
    web.setItem(key, value);
    return;
  }

  memoryFallback.set(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (hasSecureStoreApi()) {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch {
      // fallback below
    }
  }

  const web = getWebStorage();
  if (web) {
    web.removeItem(key);
    return;
  }

  memoryFallback.delete(key);
}
