export type MessageAttachmentKind =
  | 'image'
  | 'audio'
  | 'video'
  | 'apk'
  | 'pwa'
  | 'zip'
  | 'preview'
  | 'file';

export type MessageAttachment = {
  kind: MessageAttachmentKind;
  label: string;
  url: string;
};

const ATTACHMENT_URL = String.raw`(?:https?:\/\/|\/)[^)\s]+`;
const ATTACHMENT_LINK_RE = new RegExp(
  String.raw`!\[([^\]]*)\]\((${ATTACHMENT_URL})\)|\[(image|file|audio|video|apk|pwa|zip|artifact|preview_url|cloud_preview|sandbox_preview)(?::([^\]]*))?\]\((${ATTACHMENT_URL})\)`,
  'gi',
);
const RAW_IMAGE_URL_RE = /((?:https?:\/\/|\/)[^\s<>"')\]]+\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s<>"')\]]*)?)/gi;

function cleanUrl(url: string) {
  return url.replace(/[),.;!?]+$/g, '');
}

function kindFromToken(tokenKind: string, url: string): MessageAttachmentKind {
  const text = `${tokenKind} ${url}`.toLowerCase();
  if (tokenKind === 'image' || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(url)) {
    return 'image';
  }
  if (tokenKind === 'audio') return 'audio';
  if (tokenKind === 'video') return 'video';
  if (tokenKind === 'apk' || text.includes('.apk')) return 'apk';
  if (tokenKind === 'pwa' || text.includes('pwa')) return 'pwa';
  if (tokenKind === 'zip' || text.includes('.zip')) return 'zip';
  if (text.includes('preview') || /\.preview\./.test(url)) return 'preview';
  return 'file';
}

export function parseMessageContent(content: string) {
  const cleanContent = String(content || '')
    .replace(/┌─\s*来源标识[\s\S]*?└[^\n]*\n?/g, '')
    .replace(/^\[TASK_STATUS\][^\n]*(?:\n|$)/gim, '')
    .replace(/^\[TASK_SUMMARY\][^\n]*(?:\n|$)/gim, '')
    .replace(/^\[TASK_BLOCKED\][^\n]*(?:\n|$)/gim, '')
    .replace(/^\[TASK_REVIEW\][^\n]*(?:\n|$)/gim, '');
  const attachments: MessageAttachment[] = [];
  const seen = new Set<string>();
  ATTACHMENT_LINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTACHMENT_LINK_RE.exec(cleanContent))) {
    const imageLabel = match[1] || '';
    const imageUrl = cleanUrl(match[2] || '');
    const tokenKind = String(match[3] || '').toLowerCase();
    const tokenLabel = match[4] || '';
    const tokenUrl = cleanUrl(match[5] || '');
    const url = imageUrl || tokenUrl;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    attachments.push({
      url,
      kind: imageUrl ? 'image' : kindFromToken(tokenKind, url),
      label: imageLabel || tokenLabel || tokenKind || 'Attachment',
    });
  }

  RAW_IMAGE_URL_RE.lastIndex = 0;
  while ((match = RAW_IMAGE_URL_RE.exec(cleanContent))) {
    const url = cleanUrl(match[1] || '');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    attachments.push({ url, kind: 'image', label: 'Image' });
  }

  ATTACHMENT_LINK_RE.lastIndex = 0;
  RAW_IMAGE_URL_RE.lastIndex = 0;
  const displayText = cleanContent
    .replace(/\[FILE_CONTENT[^\]]*\][\s\S]*?\[\/FILE_CONTENT\]/gi, '')
    .replace(ATTACHMENT_LINK_RE, '')
    .replace(RAW_IMAGE_URL_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const visibleText = /^(?:🤔\s*)?Agent thinking\.{0,3}$/i.test(displayText) ? '' : displayText;

  return { displayText: visibleText, attachments };
}
