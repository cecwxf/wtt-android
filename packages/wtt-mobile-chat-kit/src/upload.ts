export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export type PendingUploadAsset = {
  url: string;
  previewUrl?: string;
  filename: string;
  kind: 'image' | 'audio' | 'video' | 'file';
  token: string;
  size?: number;
  mimeType: string;
};

export type LocalUploadAsset = {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
};

export type UploadMobileAssetOptions = {
  baseUrl: string;
  token: string;
  resolveUploadUrl?: (url: string) => string;
  onProgress?: (percent: number) => void;
};

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function filenameFromUri(uri: string, fallback = 'wtt-attachment') {
  const clean = uri.split('?')[0].split('#')[0];
  const raw = clean.split('/').pop() || fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function inferMimeType(asset: LocalUploadAsset) {
  if (asset.mimeType) return asset.mimeType;
  const name = asset.name || filenameFromUri(asset.uri);
  return MIME_BY_EXT[extensionOf(name)] || 'application/octet-stream';
}

function kindForMime(mimeType: string): PendingUploadAsset['kind'] {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
}

function tokenForAsset(
  kind: PendingUploadAsset['kind'],
  filename: string,
  url: string,
  extractedText = '',
) {
  const base =
    kind === 'image'
      ? `![${filename}](${url})`
      : kind === 'audio'
        ? `[audio:${filename}](${url})`
        : kind === 'video'
          ? `[video:${filename}](${url})`
          : `[file:${filename}](${url})`;
  const text = extractedText.trim();
  if (!text) return base;
  return `${base}\n\n[FILE_CONTENT name="${filename.replace(/"/g, '\\"')}"]\n${text}\n[/FILE_CONTENT]`;
}

function resolveUrl(url: string, resolver?: (url: string) => string) {
  return resolver ? resolver(url) : url;
}

function uploadBlobWithProgress(
  uploadUrl: string,
  blob: Blob,
  mimeType: string,
  options: UploadMobileAssetOptions,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 90));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.responseText || `Upload failed: ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload network failed')));
    xhr.open('PUT', resolveUrl(uploadUrl, options.resolveUploadUrl));
    xhr.setRequestHeader('Content-Type', mimeType);
    xhr.send(blob);
  });
}

async function commitUploadedAsset(uploadToken: string, options: UploadMobileAssetOptions) {
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const commit = await fetch(`${options.baseUrl}/media/commit`, {
      method: 'POST',
      headers: authHeaders(options.token),
      body: JSON.stringify({ upload_token: uploadToken }),
    });
    if (commit.ok) return commit;
    lastError = await commit.text();
    if (!lastError.includes('File not uploaded yet')) break;
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  throw new Error(`Commit failed: ${lastError || 'unknown error'}`);
}

export async function uploadMobileAsset(
  asset: LocalUploadAsset,
  options: UploadMobileAssetOptions,
): Promise<PendingUploadAsset> {
  const filename = asset.name || filenameFromUri(asset.uri);
  const mimeType = inferMimeType(asset);
  const blob = await fetch(asset.uri).then((response) => response.blob());
  const size = blob.size || asset.size || 0;
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error(`File too large. Max 100MB, got ${(size / (1024 * 1024)).toFixed(1)}MB`);
  }

  options.onProgress?.(1);
  const sign = await fetch(`${options.baseUrl}/media/sign`, {
    method: 'POST',
    headers: authHeaders(options.token),
    body: JSON.stringify({ filename, mime_type: mimeType, size }),
  });
  if (!sign.ok) throw new Error(`Sign failed: ${await sign.text()}`);
  const signed = (await sign.json()) as { upload_url?: string; upload_token?: string };
  if (!signed.upload_url || !signed.upload_token) throw new Error('Invalid upload signature');

  await uploadBlobWithProgress(signed.upload_url, blob, mimeType, options);
  options.onProgress?.(95);

  const commit = await commitUploadedAsset(signed.upload_token, options);
  const committed = (await commit.json()) as {
    url?: string;
    filename?: string;
    size?: number;
    mime_type?: string;
    extracted_text?: string;
  };
  const url = resolveUrl(String(committed.url || ''), options.resolveUploadUrl);
  if (!url) throw new Error('Upload committed without URL');

  const kind = kindForMime(committed.mime_type || mimeType);
  options.onProgress?.(100);
  return {
    url,
    previewUrl: asset.uri,
    filename: committed.filename || filename,
    kind,
    size: committed.size || size,
    mimeType: committed.mime_type || mimeType,
    token: tokenForAsset(kind, committed.filename || filename, url, committed.extracted_text || ''),
  };
}
