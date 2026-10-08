import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Redirect, router, useLocalSearchParams, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Alert,
  Image,
  BackHandler,
  Keyboard,
  Linking,
  Platform,
  PermissionsAndroid,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { WebViewErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { nativeSpeechCapabilityScript } from '@/lib/speech/protocol';
import { nativeSpeechEnabled, useNativeSpeechBridge } from '@/lib/speech/use-native-speech-bridge';
import { useAuthStore } from '@/stores/auth';
import { WTT_API_URL } from '@/lib/api/base-url';
import { LaunchLink } from '@/lib/navigation/launch-link';
import { authResumeUrl } from '@/lib/navigation/auth-entry';
import { isTrustedAppUrl, NativeWebSession } from '@/lib/auth/native-web-session';
import { useNativeFilesBridge } from '@/lib/files/use-native-files-bridge';
import { NativeFileDownloadCard } from '@/components/NativeFileDownloadCard';
import { NativeNotificationsBridge } from '@/lib/notifications/protocol';
import { notificationSettings, saveNotificationSettings, showChatNotification } from '@/lib/notifications/native-notifications';

const DEFAULT_WEB_URL = 'https://www.ultraspace.ai';
const ANDROID_RESET_SESSION_MESSAGE = 'WTT_ANDROID_RESET_SESSION';
const ANDROID_DOWNLOAD_MESSAGE = 'WTT_ANDROID_DOWNLOAD';
const LOADING_FALLBACK_MS = 12000;
const MAX_TRANSIENT_WEB_RETRIES = 2;
const WEB_RETRY_DELAY_MS = 900;
const PREVENT_INITIAL_AUTOFOCUS_SCRIPT = `
  (function() {
    if (window.__WTT_ANDROID_FOCUS_GUARD__) return true;
    window.__WTT_ANDROID_FOCUS_GUARD__ = true;
    window.__WTT_ANDROID_DOWNLOAD__ = function(url) {
      var postDownload = function(payload) {
        try {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({
            type: ${JSON.stringify(ANDROID_DOWNLOAD_MESSAGE)}
          }, payload)));
        } catch (error) {}
      };
      var filenameFromUrl = function(input) {
        try {
          var pathname = new URL(input, window.location.href).pathname;
          var last = pathname.split('/').filter(Boolean).pop();
          return decodeURIComponent(last || 'wtt-download');
        } catch (error) {
          return 'wtt-download';
        }
      };
      var filenameFromDisposition = function(disposition, fallback) {
        if (!disposition) return fallback;
        var utf = disposition.match(/filename\\*=UTF-8''([^;]+)/i);
        if (utf && utf[1]) {
          try { return decodeURIComponent(utf[1].replace(/["']/g, '')); } catch (error) {}
        }
        var plain = disposition.match(/filename="?([^";]+)"?/i);
        return plain && plain[1] ? plain[1] : fallback;
      };
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.withCredentials = true;
        xhr.responseType = 'blob';
        var fallbackName = filenameFromUrl(url);
        postDownload({ status: 'start', url: url, fileName: fallbackName, loaded: 0, total: 0 });
        xhr.onprogress = function(event) {
          postDownload({
            status: 'progress',
            url: url,
            fileName: fallbackName,
            loaded: event.loaded || 0,
            total: event.lengthComputable ? event.total : 0,
            percent: event.lengthComputable && event.total ? Math.round(event.loaded / event.total * 100) : null
          });
        };
        xhr.onerror = function() {
          postDownload({ status: 'error', url: url, fileName: fallbackName, error: '下载失败' });
        };
        xhr.onload = function() {
          if (xhr.status < 200 || xhr.status >= 300) {
            postDownload({ status: 'error', url: url, fileName: fallbackName, error: 'HTTP ' + xhr.status });
            return;
          }
          var fileName = filenameFromDisposition(xhr.getResponseHeader('Content-Disposition'), fallbackName);
          postDownload({ status: 'saving', url: url, fileName: fileName, loaded: xhr.response && xhr.response.size || 0, total: xhr.response && xhr.response.size || 0, percent: 100 });
          var blobUrl = URL.createObjectURL(xhr.response);
          var link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          link.rel = 'noreferrer';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          window.setTimeout(function() {
            if (link.parentNode) link.parentNode.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            postDownload({ status: 'done', url: url, fileName: fileName, percent: 100 });
          }, 1000);
        };
        xhr.send();
      } catch (error) {
        postDownload({ status: 'error', url: url, error: String(error && error.message || error || '下载失败') });
      }
    };
    var userInteracted = false;
    var unlock = function() { userInteracted = true; };
    ['touchstart', 'pointerdown', 'keydown'].forEach(function(eventName) {
      window.addEventListener(eventName, unlock, { capture: true, once: true });
    });
    var originalFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function() {
      var tagName = String(this && this.tagName || '').toUpperCase();
      if (!userInteracted && /^(INPUT|TEXTAREA|SELECT)$/.test(tagName)) return;
      return originalFocus.apply(this, arguments);
    };
    window.setTimeout(unlock, 2500);
    true;
  })();
`;
type RouteParams = Record<string, string | string[] | undefined>;
const launchLink = new LaunchLink();
type TopFrameNavigation = WebViewNavigation & { isTopFrame?: boolean };
type DownloadProgress = {
  status: 'start' | 'progress' | 'saving' | 'done' | 'error';
  url?: string;
  fileName?: string;
  loaded?: number;
  total?: number;
  percent?: number | null;
  error?: string;
};

function isTransientWebViewError(code: number, description: string): boolean {
  if (code === -8) return true;
  return /ERR_CONNECTION_TIMED_OUT|ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|timeout/i.test(
    description,
  );
}

function webViewErrorText(code: number, description: string): string {
  if (code === -8 || /ERR_CONNECTION_TIMED_OUT/i.test(description)) {
    return '网络连接超时，WTT 已尝试自动重连。请检查当前 Wi-Fi/蜂窝网络后重试。';
  }
  if (/ERR_INTERNET_DISCONNECTED/i.test(description)) {
    return '当前网络不可用，请恢复网络后重试。';
  }
  return description || '页面加载失败，请稍后重试。';
}

function normalizeBaseUrl(raw?: string): string {
  const value = String(raw || '').trim() || DEFAULT_WEB_URL;
  return value.replace(/\/+$/, '');
}

function isAuthProviderUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return ['github.com', 'google.com', 'googleusercontent.com', 'twitter.com', 'x.com'].some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function isMobileFeedUrl(url: string): boolean {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') === '/mobile/feed';
  } catch {
    return false;
  }
}

function isMobileLoginUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '');
    return pathname === '/mobile/login' || pathname === '/login';
  } catch {
    return false;
  }
}

function mobileUrlForAllowedHostNavigation(url: string, webBaseUrl: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    if (
      pathname === '/mobile/feed' ||
      pathname === '/feed' ||
      pathname === '/mobile/settings' ||
      pathname === '/mobile/login' ||
      pathname === '/login' ||
      pathname === '/upgrade' ||
      pathname.startsWith('/api/auth')
    ) {
      if (pathname === '/upgrade') parsed.searchParams.set('source', Platform.OS);
      return parsed.toString();
    }
    return appendMobileParams(webBaseUrl, '/mobile/feed', {});
  } catch {
    return appendMobileParams(webBaseUrl, '/mobile/feed', {});
  }
}

function isWttAttachmentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    if (
      pathname.startsWith('/api/wtt/media/') ||
      pathname.startsWith('/media/') ||
      pathname.startsWith('/api/wtt/artifacts/') ||
      pathname.startsWith('/artifacts/')
    ) {
      return true;
    }
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|pdf|docx?|pptx?|xlsx?|csv|zip|tar|gz|md|txt|html?)(\?|#|$)/i.test(
      `${pathname}${parsed.search}`,
    );
  } catch {
    return false;
  }
}

function isTopFrameNavigation(request: TopFrameNavigation): boolean {
  return request.isTopFrame !== false;
}

function authenticatedDownloadScript(url: string): string {
  return `
    (function() {
      var url = ${JSON.stringify(url)};
      if (window.__WTT_ANDROID_DOWNLOAD__) {
        window.__WTT_ANDROID_DOWNLOAD__(url);
      } else {
        var link = document.createElement('a');
        link.href = url;
        link.download = '';
        link.rel = 'noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        window.setTimeout(function() {
          if (link.parentNode) link.parentNode.removeChild(link);
        }, 1000);
      }
    })();
    true;
  `;
}

function formatBytes(value?: number | null): string {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function appendMobileParams(
  baseUrl: string,
  path: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set('source', Platform.OS);
  for (const [key, value] of Object.entries(params)) {
    const cleaned = String(value || '').trim();
    if (cleaned) url.searchParams.set(key, cleaned);
  }
  return url.toString();
}

function routeParam(params: RouteParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function mapNativePathToWebUrl(
  pathname: string | null,
  params: RouteParams,
  webBaseUrl: string,
): string | null {
  const path = String(pathname || '').replace(/^\/+|\/+$/g, '');
  if (!path || path === 'webview') return null;

  const parts = path.split('/').filter(Boolean);
  const route = (parts[0] || 'feed').toLowerCase();
  const subRoute = (parts[1] || '').toLowerCase();
  const agentId = routeParam(params, 'agent_id') || routeParam(params, 'agentId');

  if (route === 'settings' || (route === 'mobile' && subRoute === 'settings')) {
    return appendMobileParams(webBaseUrl, '/mobile/settings', {});
  }
  if (route === 'topic') {
    return appendMobileParams(webBaseUrl, '/mobile/feed', {
      topic_id: parts[1] || routeParam(params, 'id') || routeParam(params, 'topic_id'),
      agent_id: agentId,
    });
  }
  if (route === 'chat') {
    return appendMobileParams(webBaseUrl, '/mobile/feed', {
      topic_id: parts[1] || routeParam(params, 'id') || routeParam(params, 'topic_id'),
      agent_id: agentId,
    });
  }
  if (route === 'task') {
    return appendMobileParams(webBaseUrl, '/mobile/feed', {
      task_id: parts[1] || routeParam(params, 'id') || routeParam(params, 'task_id'),
      agent_id: agentId,
    });
  }
  if (route === 'mobile' && subRoute === 'feed') {
    return appendMobileParams(webBaseUrl, '/mobile/feed', {
      topic_id: routeParam(params, 'topic_id') || routeParam(params, 'topicId'),
      task_id: routeParam(params, 'task_id') || routeParam(params, 'taskId'),
      agent_id: agentId,
    });
  }

  return appendMobileParams(webBaseUrl, '/mobile/feed', {
    topic_id: routeParam(params, 'topic_id') || routeParam(params, 'topicId'),
    task_id: routeParam(params, 'task_id') || routeParam(params, 'taskId'),
    agent_id: agentId,
  });
}

function mapDeepLinkToWebUrl(rawUrl: string | null, webBaseUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'wtt:') return null;
    const parts = [parsed.hostname, ...parsed.pathname.split('/').filter(Boolean)].filter(Boolean);
    const route = (parts[0] || 'feed').toLowerCase();
    const subRoute = (parts[1] || '').toLowerCase();
    const id = parts[1] || parsed.searchParams.get('id') || '';
    const agentId =
      parsed.searchParams.get('agent_id') || parsed.searchParams.get('agentId') || undefined;

    if (route === 'mobile' && subRoute === 'settings') {
      return appendMobileParams(webBaseUrl, '/mobile/settings', {});
    }
    if (route === 'mobile' && subRoute === 'feed') {
      return appendMobileParams(webBaseUrl, '/mobile/feed', {
        topic_id: parsed.searchParams.get('topic_id') || undefined,
        task_id: parsed.searchParams.get('task_id') || undefined,
        agent_id: agentId,
      });
    }
    if (route === 'topic') {
      return appendMobileParams(webBaseUrl, '/mobile/feed', {
        topic_id: id || parsed.searchParams.get('topic_id') || undefined,
        agent_id: agentId,
      });
    }
    if (route === 'chat') {
      return appendMobileParams(webBaseUrl, '/mobile/feed', {
        topic_id: id || parsed.searchParams.get('topic_id') || undefined,
        agent_id: agentId,
      });
    }
    if (route === 'task') {
      return appendMobileParams(webBaseUrl, '/mobile/feed', {
        task_id: id || parsed.searchParams.get('task_id') || undefined,
        agent_id: agentId,
      });
    }
    if (route === 'settings') {
      return appendMobileParams(webBaseUrl, '/mobile/settings', {});
    }
    return appendMobileParams(webBaseUrl, '/mobile/feed', {
      topic_id: parsed.searchParams.get('topic_id') || undefined,
      task_id: parsed.searchParams.get('task_id') || undefined,
      agent_id: agentId,
    });
  } catch {
    return null;
  }
}

export default function WttWebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const { handleSpeechMessage } = useNativeSpeechBridge(webViewRef);
  const nativeToken = useAuthStore((s) => s.token);
  const mountedWithSession = useRef(Boolean(nativeToken));
  const pathname = usePathname();
  const routeParams = useLocalSearchParams() as RouteParams;
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const webErrorRetryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const webBaseUrl = useMemo(
    () =>
      normalizeBaseUrl(
        Constants.expoConfig?.extra?.wttWebUrl || Constants.expoConfig?.extra?.wttApiUrl,
      ),
    [],
  );
  const mobileFeedUrl = appendMobileParams(webBaseUrl, '/mobile/feed', {});
  const [targetUrl, setTargetUrl] = useState(mobileFeedUrl);
  const targetUrlRef = useRef(mobileFeedUrl);
  const currentUrlRef = useRef(mobileFeedUrl);
  const allowedHost = useMemo(() => {
    try {
      return new URL(webBaseUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  }, [webBaseUrl]);
  const allowedOrigin = useMemo(() => new URL(webBaseUrl).origin, [webBaseUrl]);
  const readCurrentUrl = useCallback(() => currentUrlRef.current, []);
  const nativeFiles = useNativeFilesBridge(webViewRef, allowedOrigin, readCurrentUrl);
  const notificationBridge = useMemo(() => new NativeNotificationsBridge({
    origin: allowedOrigin, currentUrl: readCurrentUrl,
    userId: () => useAuthStore.getState().user?.id || useAuthStore.getState().user?.user_id || null,
    inject: script => webViewRef.current?.injectJavaScript(script),
    preferences: notificationSettings, setPreferences: saveNotificationSettings, show: showChatNotification,
  }), [allowedOrigin, readCurrentUrl]);
  const sessionBridge = useMemo(
    () =>
      new NativeWebSession({
        origin: allowedOrigin,
        apiUrl: WTT_API_URL,
        credentials: () => {
          const auth = useAuthStore.getState();
          const userId = auth.user?.id || auth.user?.user_id;
          return auth.token && userId ? { token: auth.token, userId } : null;
        },
        currentUrl: () => currentUrlRef.current,
        inject: (script) => webViewRef.current?.injectJavaScript(script),
        signOut: () => useAuthStore.getState().logout(),
        reportError: (message) => {
          setLoading(false);
          setError(message);
        },
      }),
    [allowedOrigin],
  );
  const injectedScript = useMemo(
    () => `(function(){
      if(window.top!==window||location.origin!==${JSON.stringify(allowedOrigin)})return;
      if(!${JSON.stringify(['/mobile/feed', '/mobile/settings', '/mobile/login', '/login', '/feed', '/upgrade'])}.includes(location.pathname.replace(/\\/+$/, '')))return;
      window.__WTT_NATIVE_SESSION_PENDING__=${Boolean(nativeToken)};
      try{localStorage.removeItem('__WTT_NATIVE_ACCESS_TOKEN__');}catch(e){}
      ${PREVENT_INITIAL_AUTOFOCUS_SCRIPT}\n${nativeSpeechCapabilityScript(
        nativeSpeechEnabled,
        allowedHost,
      )}})();true;`,
    [allowedHost, allowedOrigin, nativeToken],
  );
  const installSessionBridge = useCallback(
    (url: string) => {
      const nonce = Array.from(Crypto.getRandomBytes(32), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      const script = sessionBridge.openDocument(url, nonce);
      if (script) webViewRef.current?.injectJavaScript(script);
      const filesScript = nativeFiles.bridge.openDocument(url, nonce);
      if (filesScript) webViewRef.current?.injectJavaScript(filesScript);
      const notificationsScript = notificationBridge.openDocument(url, nonce);
      if (notificationsScript) webViewRef.current?.injectJavaScript(notificationsScript);
    },
    [sessionBridge, nativeFiles.bridge, notificationBridge],
  );

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      const resumed = next === 'active' && previous !== 'active';
      previous = next;
      if (!resumed || !isTrustedAppUrl(currentUrlRef.current, allowedOrigin)) return;
      webViewRef.current?.injectJavaScript(`(function(){if(window.top!==window||location.origin!==${JSON.stringify(allowedOrigin)})return;
        window.dispatchEvent(new Event('focus'));window.dispatchEvent(new CustomEvent('wtt-native-resume'));})();true;`);
    });
    return () => subscription.remove();
  }, [allowedOrigin]);

  useEffect(() => {
    sessionBridge.credentialsChanged();
    notificationBridge.invalidate();
    if (nativeToken) installSessionBridge(currentUrlRef.current);
  }, [nativeToken, installSessionBridge, sessionBridge, notificationBridge]);
  useEffect(() => () => sessionBridge.invalidate(), [sessionBridge]);
  useEffect(() => () => notificationBridge.invalidate(), [notificationBridge]);
  const nativeRouteUrl = useMemo(
    () =>
      authResumeUrl(routeParam(routeParams, 'resume'), allowedOrigin) ||
      mapNativePathToWebUrl(pathname, routeParams, webBaseUrl),
    [allowedOrigin, pathname, routeParams, webBaseUrl],
  );

  const navigateToTargetUrl = useCallback((nextUrl: string) => {
    if (!nextUrl || targetUrlRef.current === nextUrl) return false;
    targetUrlRef.current = nextUrl;
    setError('');
    setLoading(true);
    setTargetUrl(nextUrl);
    setReloadKey((value) => value + 1);
    return true;
  }, []);

  useEffect(() => {
    if (!loading || error) return undefined;
    const timer = setTimeout(() => setLoading(false), LOADING_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [error, loading, reloadKey, targetUrl]);

  useEffect(() => {
    webErrorRetryRef.current = 0;
  }, [targetUrl]);

  useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (downloadClearTimerRef.current) clearTimeout(downloadClearTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    ]).catch(() => undefined);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const currentUrl = currentUrlRef.current;
      if (canGoBack && !isMobileLoginUrl(currentUrl)) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  const loadDeepLink = useCallback(
    (url: string | null) => {
      const mapped = mapDeepLinkToWebUrl(url, webBaseUrl);
      if (!mapped) return false;
      return navigateToTargetUrl(mapped);
    },
    [navigateToTargetUrl, webBaseUrl],
  );

  const openExternalUrl = useCallback((url: string) => {
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        void WebBrowser.openBrowserAsync(url);
        return;
      }
    } catch {
      // Fall through to platform URL handling.
    }
    void Linking.openURL(url).catch(() => undefined);
  }, []);

  const resetWebSession = useCallback(() => {
    Alert.alert('重新登录 WTT', '将清理 WebView 缓存并回到移动登录页。', [
      { text: '取消', style: 'cancel' },
      {
        text: '继续',
        style: 'destructive',
        onPress: async () => {
          sessionBridge.invalidate();
          await useAuthStore
            .getState()
            .logout()
            .catch(() => undefined);
          webViewRef.current?.injectJavaScript(`
            (async function(){
              if(window.top!==window||location.origin!==${JSON.stringify(allowedOrigin)})return;
              try{localStorage.removeItem('__WTT_NATIVE_ACCESS_TOKEN__');sessionStorage.clear();
                var csrf=await fetch('/api/auth/csrf',{credentials:'include'}).then(function(r){return r.json();});
                await fetch('/api/auth/signout',{method:'POST',credentials:'include',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf.csrfToken,json:'true'})});
              }catch(e){}
              location.replace(${JSON.stringify(appendMobileParams(webBaseUrl, '/mobile/login', { callbackUrl: '/mobile/feed' }))});
            })();
            true;
          `);
          webViewRef.current?.clearCache?.(true);
          webViewRef.current?.clearHistory?.();
          setCanGoBack(false);
        },
      },
    ]);
  }, [allowedOrigin, sessionBridge, webBaseUrl]);

  useEffect(() => {
    let mounted = true;
    void launchLink
      .readInitial(() => ExpoLinking.getInitialURL(), nativeRouteUrl)
      .then((url) => {
        if (mounted) loadDeepLink(url);
      })
      .catch(() => undefined);
    const subscription = ExpoLinking.addEventListener('url', ({ url }) => {
      launchLink.observeNavigation();
      loadDeepLink(url);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [loadDeepLink, nativeRouteUrl]);

  useEffect(() => {
    if (!nativeRouteUrl) return;
    navigateToTargetUrl(nativeRouteUrl);
  }, [nativeRouteUrl, navigateToTargetUrl]);

  const shouldStartLoad = useCallback(
    (request: TopFrameNavigation) => {
      const url = request.url || '';
      if (url === 'about:blank') return true;
      if (!url) return false;
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'wtt:') return !loadDeepLink(url);
        if (!isTopFrameNavigation(request))
          return parsed.protocol === 'https:' || parsed.protocol === 'blob:';
        if (parsed.origin === allowedOrigin && parsed.protocol === 'https:') {
          if (isWttAttachmentUrl(url)) {
            if (!isTopFrameNavigation(request)) return true;
            setLoading(false);
            webViewRef.current?.injectJavaScript(authenticatedDownloadScript(url));
            return false;
          }
          const mobileUrl = mobileUrlForAllowedHostNavigation(url, webBaseUrl);
          if (!mobileUrl || mobileUrl === url) return true;
          return !navigateToTargetUrl(mobileUrl);
        }
        if (isAuthProviderUrl(url)) return true;
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          openExternalUrl(url);
          return false;
        }
        openExternalUrl(url);
        return false;
      } catch {
        return false;
      }
    },
    [allowedOrigin, loadDeepLink, navigateToTargetUrl, openExternalUrl, webBaseUrl],
  );

  const handleWebMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const data = event.nativeEvent.data;
      try {
        const eventUrl = event.nativeEvent.url;
        if (
          !eventUrl ||
          !isTrustedAppUrl(eventUrl, allowedOrigin) ||
          !isTrustedAppUrl(currentUrlRef.current, allowedOrigin)
        )
          return;
        if (sessionBridge.handle(data, eventUrl)) return;
        if (nativeFiles.bridge.handle(data, eventUrl)) return;
        if (notificationBridge.handle(data, eventUrl)) return;
        if (handleSpeechMessage(data)) return;
      } catch {
        return;
      }
      if (data === ANDROID_RESET_SESSION_MESSAGE) {
        resetWebSession();
        return;
      }
      try {
        const payload = JSON.parse(data) as { type?: string } & DownloadProgress;
        if (payload.type !== ANDROID_DOWNLOAD_MESSAGE) return;
        if (downloadClearTimerRef.current) {
          clearTimeout(downloadClearTimerRef.current);
          downloadClearTimerRef.current = null;
        }
        setDownloadProgress({
          status: payload.status,
          url: payload.url,
          fileName: payload.fileName,
          loaded: payload.loaded,
          total: payload.total,
          percent: payload.percent,
          error: payload.error,
        });
        if (payload.status === 'done' || payload.status === 'error') {
          downloadClearTimerRef.current = setTimeout(
            () => {
              setDownloadProgress(null);
              downloadClearTimerRef.current = null;
            },
            payload.status === 'done' ? 1800 : 4200,
          );
        }
      } catch {
        // Ignore unrelated WebView messages.
      }
    },
    [allowedOrigin, sessionBridge, nativeFiles.bridge, notificationBridge, handleSpeechMessage, resetWebSession],
  );

  const handleWebError = useCallback((event: WebViewErrorEvent) => {
    const code = Number(event.nativeEvent.code || 0);
    const description = String(event.nativeEvent.description || '');
    if (
      isTransientWebViewError(code, description) &&
      webErrorRetryRef.current < MAX_TRANSIENT_WEB_RETRIES
    ) {
      const retryAttempt = webErrorRetryRef.current + 1;
      webErrorRetryRef.current = retryAttempt;
      setError('');
      setLoading(true);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        setReloadKey((value) => value + 1);
      }, WEB_RETRY_DELAY_MS * retryAttempt);
      return;
    }
    setLoading(false);
    setError(webViewErrorText(code, description));
  }, []);

  const downloadPercent =
    typeof downloadProgress?.percent === 'number'
      ? Math.max(0, Math.min(100, downloadProgress.percent))
      : null;
  const downloadLoadedText = formatBytes(downloadProgress?.loaded);
  const downloadTotalText = formatBytes(downloadProgress?.total);

  if (!mountedWithSession.current && !nativeToken) {
    return (
      <Redirect
        href={{ pathname: '/(auth)/login', params: { returnTo: nativeRouteUrl || mobileFeedUrl } }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{ uri: targetUrl }}
        style={styles.webview}
        originWhitelist={['*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        geolocationEnabled
        javaScriptEnabled
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        mediaPlaybackRequiresUserAction={false}
        saveFormDataDisabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled={Platform.OS === 'android'}
        onLoadStart={(event) => {
          currentUrlRef.current = event.nativeEvent.url;
          sessionBridge.invalidate();
          nativeFiles.bridge.invalidate();
          notificationBridge.invalidate();
          setLoading(true);
          setError('');
        }}
        onLoadProgress={(event) => {
          if (event.nativeEvent.progress >= 0.8) {
            webErrorRetryRef.current = 0;
            Keyboard.dismiss();
            setLoading(false);
          }
        }}
        onLoad={() => {
          webErrorRetryRef.current = 0;
          Keyboard.dismiss();
          setLoading(false);
        }}
        onLoadEnd={(event) => {
          currentUrlRef.current = event.nativeEvent.url;
          installSessionBridge(event.nativeEvent.url);
          Keyboard.dismiss();
          setLoading(false);
        }}
        onError={handleWebError}
        renderError={() => <View style={styles.webviewFallback} />}
        onContentProcessDidTerminate={() => {
          setLoading(true);
          setReloadKey((value) => value + 1);
        }}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 500) {
            setError(`HTTP ${event.nativeEvent.statusCode}`);
          }
        }}
        onFileDownload={(event) => {
          if (Platform.OS !== 'android') openExternalUrl(event.nativeEvent.downloadUrl);
        }}
        onMessage={handleWebMessage}
        downloadingMessage="正在下载 WTT 文件..."
        lackPermissionToDownloadMessage="无法下载文件，请在系统设置中允许 WTT 访问存储。"
        onNavigationStateChange={(state) => {
          const previousUrl = currentUrlRef.current;
          currentUrlRef.current = state.url;
          if (!isTrustedAppUrl(state.url, allowedOrigin)) {
            nativeFiles.bridge.invalidate();
            notificationBridge.invalidate();
          }
          if (isMobileLoginUrl(state.url) && !useAuthStore.getState().token) {
            sessionBridge.invalidate();
            router.replace('/(auth)/login');
            return;
          }
          if (isMobileFeedUrl(state.url) && isMobileLoginUrl(previousUrl)) {
            setTimeout(() => webViewRef.current?.clearHistory?.(), 0);
            setCanGoBack(false);
            return;
          }
          setCanGoBack(state.canGoBack && !isMobileLoginUrl(state.url));
        }}
        onShouldStartLoadWithRequest={shouldStartLoad}
        applicationNameForUserAgent={`WTT-${Platform.OS === 'ios' ? 'iOS' : 'Android'}-WebView/${Constants.expoConfig?.version || '1.2.20'}`}
      />
      {nativeFiles.state && <NativeFileDownloadCard state={nativeFiles.state} onCancel={nativeFiles.cancel} onShare={() => void nativeFiles.share()} onDismiss={nativeFiles.dismiss} />}
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>WTT 加载失败</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              webErrorRetryRef.current = 0;
              setError('');
              setLoading(true);
              setReloadKey((value) => value + 1);
            }}
          >
            <Text style={styles.retryText}>重新加载</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetButton} onPress={resetWebSession}>
            <Text style={styles.resetText}>清缓存并重新登录</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {downloadProgress ? (
        <View style={styles.downloadCard}>
          <View style={styles.downloadHeader}>
            <Text style={styles.downloadTitle} numberOfLines={1}>
              {downloadProgress.status === 'error'
                ? '下载失败'
                : downloadProgress.status === 'done'
                  ? '下载完成'
                  : downloadProgress.status === 'saving'
                    ? '正在保存'
                    : '正在下载'}
            </Text>
            {downloadPercent !== null ? (
              <Text style={styles.downloadPercent}>{downloadPercent}%</Text>
            ) : null}
          </View>
          <Text style={styles.downloadFileName} numberOfLines={1}>
            {downloadProgress.fileName || 'WTT 附件'}
          </Text>
          {downloadProgress.status === 'error' ? (
            <Text style={styles.downloadError} numberOfLines={2}>
              {downloadProgress.error || '请稍后重试'}
            </Text>
          ) : (
            <>
              <View style={styles.downloadProgressTrack}>
                <View
                  style={[styles.downloadProgressFill, { width: `${downloadPercent ?? 18}%` }]}
                />
              </View>
              <Text style={styles.downloadMeta} numberOfLines={1}>
                {downloadTotalText
                  ? `${downloadLoadedText || '0 B'} / ${downloadTotalText}`
                  : downloadLoadedText || '正在获取文件大小'}
              </Text>
            </>
          )}
        </View>
      ) : null}
      {loading && !error ? (
        <View pointerEvents="none" style={styles.loadingScreen}>
          <View style={styles.loadingLogo}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.loadingLogoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.loadingTitle}>WTT</Text>
          <Text style={styles.loadingTagline}>Link the agent world</Text>
          <ActivityIndicator style={styles.loadingSpinner} color="#2563eb" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  webviewFallback: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingScreen: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 28,
  },
  loadingLogo: {
    width: 84,
    height: 84,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#1d4ed8',
  },
  loadingLogoImage: {
    width: 84,
    height: 84,
  },
  loadingTitle: {
    marginTop: 18,
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '800',
  },
  loadingTagline: {
    marginTop: 8,
    color: '#475569',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingSpinner: {
    marginTop: 22,
  },
  errorCard: {
    position: 'absolute',
    zIndex: 10,
    left: 18,
    right: 18,
    top: 72,
    borderRadius: 24,
    backgroundColor: '#fff',
    padding: 18,
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  errorText: {
    marginTop: 8,
    color: '#64748b',
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '800',
  },
  resetButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resetText: {
    color: '#475569',
    fontWeight: '800',
  },
  downloadCard: {
    position: 'absolute',
    zIndex: 12,
    left: 16,
    right: 16,
    bottom: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  downloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  downloadTitle: {
    flex: 1,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  downloadPercent: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '800',
  },
  downloadFileName: {
    marginTop: 4,
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  downloadProgressTrack: {
    marginTop: 10,
    height: 6,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  downloadProgressFill: {
    height: 6,
    minWidth: 12,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  downloadMeta: {
    marginTop: 7,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  downloadError: {
    marginTop: 6,
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
});
