import type { MobileTopicMessage } from './messages';

export type MobileVisibleMessage = MobileTopicMessage & { content: string };

const STATUS_SEMANTIC_TYPES = new Set([
  'task_request',
  'TASK_REQUEST',
  'system',
  'SYSTEM',
  'notification',
  'NOTIFICATION',
]);

const PROGRESS_PATTERNS = [
  /^Time:\s*\d{1,2}:\d{2}:\d{2}\s*\n\s*Progress:\s*\d+%/m,
  /^Status:\s*\[Task:/m,
  /^\[STATUS\]\s*(Started|Completed)/m,
  /^Plan Mode result:/m,
  /^Plan Mode结果/m,
  /^Progress:\s*\d+%\s*$/m,
  /^\[TASK_STATUS\]/m,
  /^\[TASK_RUN\]/m,
  /^\[TASK_REQUEST\]/m,
  /^\[[^\]]+\]\s*状态=.*\|\s*动作=.*心跳=\d+s/m,
  /^\[[^\]]+\]\s*\|\s*状态\s*=\s*doing\b.*心跳=\d+s/m,
  /^\[[^\]]+\]\s*\|\s*状态\s*=\s*doing\b/m,
  /^🤔\s*Agent thinking/m,
];

export function mobileMessageMetadataObject(
  metadata: Record<string, unknown> | string | null | undefined,
) {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return metadata;
}

function truthyMeta(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function stripMobileMetaBlocks(content: string) {
  return String(content || '')
    .replace(/┌─\s*来源标识[\s\S]*?└[^\n]*\n?/g, '')
    .replace(/\[FILE_CONTENT[^\]]*\][\s\S]*?\[\/FILE_CONTENT\]/gi, '')
    .trim();
}

export function isMobileProgressMessage(content: string) {
  const text = String(content || '').trim();
  if (!text) return false;
  return PROGRESS_PATTERNS.some((pattern) => pattern.test(text));
}

export function isMobileMessageHidden(message: Pick<
  MobileTopicMessage,
  'content' | 'semantic_type' | 'metadata' | 'is_streaming' | 'message_id'
>) {
  const meta = mobileMessageMetadataObject(message.metadata);
  if (truthyMeta(meta.hidden) || truthyMeta(meta.ui_hidden) || truthyMeta(meta.hide_in_chat)) {
    return true;
  }
  if (message.is_streaming || String(message.message_id || '').startsWith('stream:')) {
    return true;
  }
  if (STATUS_SEMANTIC_TYPES.has(message.semantic_type || '')) {
    return true;
  }
  if (isMobileProgressMessage(message.content)) {
    return true;
  }
  return false;
}

export function visibleMobileMessageContent(message: Pick<MobileTopicMessage, 'content' | 'metadata'>) {
  const meta = mobileMessageMetadataObject(message.metadata);
  const displayContent =
    typeof meta.display_content === 'string' ? stripMobileMetaBlocks(meta.display_content) : '';
  return displayContent || stripMobileMetaBlocks(message.content);
}

export function filterVisibleMobileMessages<TMessage extends MobileTopicMessage>(
  messages: TMessage[],
): MobileVisibleMessage[] {
  return messages
    .filter((message) => !isMobileMessageHidden(message))
    .map((message) => ({
      ...message,
      content: visibleMobileMessageContent(message),
    }))
    .filter((message) => Boolean(message.content));
}
