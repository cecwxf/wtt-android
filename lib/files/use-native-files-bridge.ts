import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import type { WebView } from 'react-native-webview';
import { useAuthStore } from '@/stores/auth';
import { WTT_API_URL } from '@/lib/api/base-url';
import { NativeFilesBridge, type FileRequest, type FileProgress } from './native-files-protocol';

const MAX_BYTES = 100 * 1024 * 1024;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
type DownloadState = FileProgress & { status: 'downloading' | 'ready' | 'sharing' | 'cancelled' | 'error'; filename: string; shareError?: boolean };
type Active = { requestId: string; abort: AbortController; task?: FileSystem.DownloadResumable };
type Saved = { userId: string; directory: string; uri: string; mimeType: string };

export function useNativeFilesBridge(webView: RefObject<WebView | null>, origin: string, currentUrl: () => string) {
  const [state, setState] = useState<DownloadState | null>(null);
  const active = useRef<Active | null>(null);
  const saved = useRef<Saved | null>(null);
  const sharing = useRef(false);
  const mounted = useRef(true);
  const token = useAuthStore(value => value.token);

  const cancel = useCallback((requestId?: string) => {
    const value = active.current;
    if (!value || (requestId && value.requestId !== requestId)) return;
    value.abort.abort();
    void value.task?.cancelAsync().catch(() => {});
  }, []);

  const discard = useCallback(async () => {
    const value = saved.current;
    saved.current = null;
    if (value) await FileSystem.deleteAsync(value.directory, { idempotent: true }).catch(() => {});
  }, []);

  const download = useCallback(async (request: FileRequest, current: () => boolean, progress: (value: FileProgress) => void) => {
    const credentials = useAuthStore.getState();
    const userId = credentials.user?.id || credentials.user?.user_id;
    const ownerToken = credentials.token;
    if (!userId || !ownerToken || !FileSystem.cacheDirectory || active.current || sharing.current || new URL(WTT_API_URL).protocol !== 'https:') throw new Error('File download unavailable');
    const targetId = request.workspaceId || request.agentId;
    if (!targetId) throw new Error('File download target unavailable');
    const operation: Active = { requestId: request.requestId, abort: new AbortController() };
    active.current = operation;
    const isCurrent = () => current() && mounted.current && active.current === operation && !operation.abort.signal.aborted
      && useAuthStore.getState().token === ownerToken && useAuthStore.getState().user?.id === userId;
    const filename = Array.from(request.filename.replace(/[\x00-\x1f\\/:*?"<>|]/g, '_')).slice(0, 60).join('') || 'download';
    const directory = `${FileSystem.cacheDirectory}wtt-file-${Crypto.randomUUID()}/`;
    const uri = `${directory}${filename}`;
    const resource = request.workspaceId
      ? `workspaces/${encodeURIComponent(targetId)}`
      : `hosts/agents/${encodeURIComponent(targetId)}`;
    const base = `${WTT_API_URL.replace(/\/+$/, '')}/${resource}/workspace`;
    const query = new URLSearchParams({ path: request.path });
    const deadline = setTimeout(() => cancel(request.requestId), 15 * 60 * 1000);
    let published = false;
    try {
      await discard();
      if (mounted.current) setState({ status: 'downloading', filename, loaded: 0, total: 0 });
      const metadataTimeout = setTimeout(() => operation.abort.abort(), 15000);
      let metadata;
      try {
        const response = await fetch(`${base}/stat?${query}`, { headers: { Authorization: `Bearer ${ownerToken}` }, signal: operation.abort.signal, redirect: 'error' });
        if (!response.ok) throw new Error('Workspace metadata unavailable');
        metadata = await response.json();
      } finally { clearTimeout(metadataTimeout); }
      if (!Number.isSafeInteger(metadata.size) || metadata.size < 0 || metadata.size > MAX_BYTES || !isCurrent()) throw new Error('Invalid file size or account');
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      let lastProgress = 0;
      operation.task = FileSystem.createDownloadResumable(`${base}/content?${query}&download=true`, uri,
        { headers: { Authorization: `Bearer ${ownerToken}` } }, data => {
          if (!isCurrent() || data.totalBytesWritten > MAX_BYTES || data.totalBytesExpectedToWrite > MAX_BYTES) { cancel(request.requestId); return; }
          if (Date.now() - lastProgress < 250) return;
          lastProgress = Date.now();
          const value = { loaded: data.totalBytesWritten, total: metadata.size };
          progress(value);
          setState({ status: 'downloading', filename, ...value });
        });
      const result = await operation.task.downloadAsync();
      if (!result || result.status !== 200 || !isCurrent()) throw new Error('Workspace download failed');
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || info.isDirectory || info.size !== metadata.size || !isCurrent()) throw new Error('Incomplete workspace download');
      const mimeType = String(metadata.content_type || 'application/octet-stream').split(';')[0];
      saved.current = { userId, directory, uri, mimeType };
      published = true;
      progress({ loaded: info.size, total: info.size });
      setState({ status: 'ready', filename, loaded: info.size, total: info.size });
    } catch (error) {
      if (mounted.current && current()) setState({ status: operation.abort.signal.aborted ? 'cancelled' : 'error', filename, loaded: 0, total: 0 });
      if (operation.abort.signal.aborted) throw Object.assign(new Error('File transfer cancelled'), { name: 'AbortError' });
      throw error;
    } finally {
      clearTimeout(deadline);
      if (active.current === operation) active.current = null;
      if (!published) await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => {});
    }
  }, [cancel, discard]);

  const bridge = useMemo(() => new NativeFilesBridge({ origin, currentUrl, download, cancel,
    inject: script => webView.current?.injectJavaScript(script),
  }), [origin, currentUrl, download, cancel, webView]);

  useEffect(() => {
    bridge.invalidate();
    void discard();
    setState(null);
  }, [token, bridge, discard]);

  useEffect(() => {
    mounted.current = true;
    // Remove only this feature's expired cache directories left by an interrupted app.
    const cache = FileSystem.cacheDirectory;
    if (cache) void (async () => {
      for (const name of await FileSystem.readDirectoryAsync(cache)) {
        if (!/^wtt-file-[a-f0-9-]{36}$/.test(name)) continue;
        const directory = `${cache}${name}/`;
        const info = await FileSystem.getInfoAsync(directory);
        if (info.exists && info.isDirectory && info.modificationTime * 1000 < Date.now() - CACHE_MAX_AGE_MS && saved.current?.directory !== directory) {
          await FileSystem.deleteAsync(directory, { idempotent: true });
        }
      }
    })().catch(() => {});
    return () => { mounted.current = false; bridge.invalidate(); void discard(); };
  }, [bridge, discard]);

  const share = useCallback(async () => {
    const value = saved.current;
    if (!value || sharing.current || value.userId !== useAuthStore.getState().user?.id) return;
    sharing.current = true;
    if (mounted.current) setState(previous => previous && { ...previous, status: 'sharing' });
    let failed = false;
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing unavailable');
      if (saved.current !== value || useAuthStore.getState().user?.id !== value.userId) return;
      await Sharing.shareAsync(value.uri, { mimeType: value.mimeType });
    } catch { failed = true; }
    finally {
      sharing.current = false;
      if (mounted.current && saved.current === value) setState(previous => previous && { ...previous, status: 'ready', shareError: failed });
    }
  }, []);

  const dismiss = useCallback(() => { cancel(); void discard(); setState(null); }, [cancel, discard]);
  return { bridge, state, cancel: () => cancel(), share, dismiss };
}
