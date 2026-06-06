import Constants from 'expo-constants';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';

const DEFAULT_WEB_URL = 'https://www.ultraspace.ai';
const ANDROID_RESET_SESSION_MESSAGE = 'WTT_ANDROID_RESET_SESSION';

function normalizeBaseUrl(raw?: string): string {
  const value = String(raw || '').trim() || DEFAULT_WEB_URL;
  return value.replace(/\/+$/, '');
}

function isAuthProviderUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith('github.com') ||
      host.endsWith('google.com') ||
      host.endsWith('googleusercontent.com') ||
      host.endsWith('twitter.com') ||
      host.endsWith('x.com')
    );
  } catch {
    return false;
  }
}

function appendMobileParams(
  baseUrl: string,
  path: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set('source', 'android');
  for (const [key, value] of Object.entries(params)) {
    const cleaned = String(value || '').trim();
    if (cleaned) url.searchParams.set(key, cleaned);
  }
  return url.toString();
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
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const webBaseUrl = useMemo(
    () =>
      normalizeBaseUrl(
        Constants.expoConfig?.extra?.wttWebUrl || Constants.expoConfig?.extra?.wttApiUrl,
      ),
    [],
  );
  const mobileFeedUrl = `${webBaseUrl}/mobile/feed?source=android`;
  const [targetUrl, setTargetUrl] = useState(mobileFeedUrl);
  const allowedHost = useMemo(() => {
    try {
      return new URL(webBaseUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  }, [webBaseUrl]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
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
      setError('');
      setLoading(true);
      setTargetUrl(mapped);
      setReloadKey((value) => value + 1);
      return true;
    },
    [webBaseUrl],
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
        onPress: () => {
          webViewRef.current?.injectJavaScript(`
            try {
              localStorage.clear();
              sessionStorage.clear();
              document.cookie.split(';').forEach(function(cookie) {
                document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
              });
            } catch (error) {}
            true;
          `);
          webViewRef.current?.clearCache?.(true);
          webViewRef.current?.clearHistory?.();
          setCanGoBack(false);
          setError('');
          setLoading(true);
          setTargetUrl(
            `${webBaseUrl}/mobile/login?callbackUrl=${encodeURIComponent('/mobile/feed')}&source=android&reset=${Date.now()}`,
          );
          setReloadKey((value) => value + 1);
        },
      },
    ]);
  }, [webBaseUrl]);

  useEffect(() => {
    let mounted = true;
    void ExpoLinking.getInitialURL().then((url) => {
      if (mounted) loadDeepLink(url);
    });
    const subscription = ExpoLinking.addEventListener('url', ({ url }) => {
      loadDeepLink(url);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [loadDeepLink]);

  const shouldStartLoad = useCallback(
    (request: WebViewNavigation) => {
      const url = request.url || '';
      if (!url || url.startsWith('about:') || url.startsWith('data:')) return true;
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (parsed.protocol === 'wtt:') return !loadDeepLink(url);
        if (host === allowedHost || isAuthProviderUrl(url)) return true;
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          openExternalUrl(url);
          return false;
        }
        openExternalUrl(url);
        return false;
      } catch {
        return true;
      }
    },
    [allowedHost, loadDeepLink, openExternalUrl],
  );

  const handleWebMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (event.nativeEvent.data === ANDROID_RESET_SESSION_MESSAGE) {
        resetWebSession();
      }
    },
    [resetWebSession],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>WTT 加载失败</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError('');
              setLoading(true);
              if (webViewRef.current) {
                webViewRef.current.reload();
              } else {
                setReloadKey((value) => value + 1);
              }
            }}
          >
            <Text style={styles.retryText}>重新加载</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetButton} onPress={resetWebSession}>
            <Text style={styles.resetText}>清缓存并重新登录</Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled={Platform.OS === 'android'}
        onLoadStart={() => {
          setLoading(true);
          setError('');
        }}
        onLoadEnd={() => setLoading(false)}
        onError={(event) => setError(event.nativeEvent.description || 'Network error')}
        onContentProcessDidTerminate={() => {
          setLoading(true);
          webViewRef.current?.reload();
        }}
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 500) {
            setError(`HTTP ${event.nativeEvent.statusCode}`);
          }
        }}
        onFileDownload={(event) => {
          openExternalUrl(event.nativeEvent.downloadUrl);
        }}
        onMessage={handleWebMessage}
        downloadingMessage="正在下载 WTT 文件..."
        lackPermissionToDownloadMessage="无法下载文件，请在系统设置中允许 WTT 访问存储。"
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        onShouldStartLoadWithRequest={shouldStartLoad}
        applicationNameForUserAgent="WTT-Android-WebView/1.0"
      />
      {loading && !error ? (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator color="#0284c7" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8f3ea',
  },
  webview: {
    flex: 1,
    backgroundColor: '#f8f3ea',
  },
  loading: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
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
});
