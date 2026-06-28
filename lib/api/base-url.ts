import Constants from 'expo-constants';

export const WTT_API_URL: string =
  Constants.expoConfig?.extra?.wttApiUrl || 'https://www.waxbyte.com';

export const WS_BASE_URL: string = WTT_API_URL.replace(/^http/, 'ws');

export function resolveWttUploadUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${WTT_API_URL}${url.startsWith('/') ? url : `/${url}`}`;
}
