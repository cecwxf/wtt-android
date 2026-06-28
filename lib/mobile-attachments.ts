import { uploadMobileAsset as uploadSharedMobileAsset } from '@wtt/mobile-chat-kit/upload';
import type {
  LocalUploadAsset,
  PendingUploadAsset,
} from '@wtt/mobile-chat-kit/upload';
import { WTT_API_URL, resolveWttUploadUrl } from '@/lib/api/base-url';

export type { LocalUploadAsset, PendingUploadAsset };

export async function uploadMobileAsset(
  asset: LocalUploadAsset,
  token: string,
  onProgress?: (percent: number) => void,
): Promise<PendingUploadAsset> {
  return uploadSharedMobileAsset(asset, {
    baseUrl: WTT_API_URL,
    token,
    resolveUploadUrl: resolveWttUploadUrl,
    onProgress,
  });
}
