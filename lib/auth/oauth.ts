import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { WTT_API_URL } from '@/lib/api/base-url';
import { exchangeNativeOAuth, nativeOAuthFlow, OAUTH_CALLBACK } from './native-oauth';
import type { OAuthCodeFlowResult, OAuthProvider } from './native-oauth';

export type { OAuthCodeFlowResult, OAuthProvider } from './native-oauth';
WebBrowser.maybeCompleteAuthSession();

const deps = {
  apiUrl: WTT_API_URL.replace(/\/+$/, ''),
  webOrigin: String(Constants.expoConfig?.extra?.wttWebUrl || 'https://www.ultraspace.ai').replace(
    /\/+$/,
    '',
  ),
  randomHex: () =>
    Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  sha256: async (value: string) =>
    (
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
        encoding: Crypto.CryptoEncoding.BASE64,
      })
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  openBrowser: (url: string, callback: string) => WebBrowser.openAuthSessionAsync(url, callback),
  dismissBrowser: () => WebBrowser.dismissAuthSession(),
};

export function isOAuthProviderEnabled(provider: OAuthProvider) {
  return ['github', 'google', 'twitter'].includes(provider);
}
export function startOAuthCodeFlow(provider: OAuthProvider) {
  return nativeOAuthFlow(provider, deps);
}
export function exchangeOAuthCode(flow: OAuthCodeFlowResult) {
  return exchangeNativeOAuth(flow, deps);
}
export function getOAuthRedirectUri() {
  return OAUTH_CALLBACK;
}
