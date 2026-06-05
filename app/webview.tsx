import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

const DEFAULT_WEB_URL = 'https://www.ultraspace.ai';

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

export default function WttWebViewScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const webBaseUrl = useMemo(
    () => normalizeBaseUrl(Constants.expoConfig?.extra?.wttWebUrl || Constants.expoConfig?.extra?.wttApiUrl),
    [],
  );
  const mobileFeedUrl = `${webBaseUrl}/mobile/feed?source=android`;
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

  const shouldStartLoad = useCallback(
    (request: WebViewNavigation) => {
      const url = request.url || '';
      if (!url || url.startsWith('about:') || url.startsWith('data:')) return true;
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host === allowedHost || isAuthProviderUrl(url)) return true;
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          void WebBrowser.openBrowserAsync(url);
          return false;
        }
      } catch {
        return true;
      }
      return true;
    },
    [allowedHost],
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
              webViewRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>重新加载</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <WebView
        ref={webViewRef}
        source={{ uri: mobileFeedUrl }}
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
        onHttpError={(event) => {
          if (event.nativeEvent.statusCode >= 500) {
            setError(`HTTP ${event.nativeEvent.statusCode}`);
          }
        }}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        onShouldStartLoadWithRequest={shouldStartLoad}
        userAgent="WTT-Android-WebView/1.0"
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
});
