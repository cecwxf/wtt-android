import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  parseMessageContent,
  type MessageAttachment,
  type MessageAttachmentKind,
} from './message-attachments';
import {
  filterMobileSlashCommands,
  type MobileSlashCommand,
} from './slash-commands';

export { parseMessageContent, type MessageAttachment, type MessageAttachmentKind };
export { mergeMobileHistory, type MobileHistoryMessage } from './history';
export {
  filterVisibleMobileMessages,
  isMobileMessageHidden,
  isMobileProgressMessage,
  mobileMessageMetadataObject,
  stripMobileMetaBlocks,
  visibleMobileMessageContent,
  type MobileVisibleMessage,
} from './message-visibility';
export {
  filterMobileSlashCommands,
  findMobileSlashCommand,
  mobileSlashCommandsForAdapter,
  mobileSlashMetadata,
  mobileSlashMetadataPayload,
  normalizeMobileSlashCommand,
  type MobileSlashCommand,
  type MobileSlashCommandFamily,
  type MobileSlashSendOptions,
} from './slash-commands';

export type MobileChatMessage = {
  id: string;
  senderId: string;
  senderType: 'human' | 'agent' | string;
  content: string;
  timestamp?: string;
};

export type MobileChatTheme = {
  accent?: string;
  accentSoft?: string;
  accentBorder?: string;
  userBubble?: string;
  agentBubble?: string;
  attachmentBubble?: string;
  text?: string;
  userText?: string;
  agentText?: string;
  textMuted?: string;
};

export type MobileRunStatus = {
  agentId?: string;
  agentName?: string;
  adapter?: string;
  model?: string;
  statusText?: string;
  statusKind?: string;
  statusLines?: { id: string; text: string; kind?: string; ts?: number }[];
  updatedAt?: number;
};

export type MobilePendingAttachment = {
  url: string;
  previewUrl?: string;
  filename: string;
  kind: 'image' | 'audio' | 'video' | 'file' | string;
  token?: string;
};

export function hasMarkdown(text: string) {
  return (
    /[*_`#\[\]!\->|]/.test(text) &&
    (/\*\*.+\*\*/.test(text) ||
      /`.+`/.test(text) ||
      /^#{1,6}\s/m.test(text) ||
      /^\s*[-*]\s/m.test(text) ||
      /^\s*\d+\.\s/m.test(text) ||
      /```/.test(text) ||
      /\[.+\]\(.+\)/.test(text))
  );
}

export function runStatusKindLabel(kind?: string) {
  const value = String(kind || '').toLowerCase();
  if (value.includes('queue')) return 'Queued';
  if (value.includes('session')) return 'Session';
  if (value.includes('command')) return 'Command';
  if (value.includes('tool')) return 'Tool';
  if (value.includes('error') || value.includes('fail')) return 'Error';
  if (value.includes('done') || value.includes('complete')) return 'Done';
  if (value.includes('response')) return 'Output';
  return 'Agent';
}

const defaultTheme: Required<MobileChatTheme> = {
  accent: '#6366F1',
  accentSoft: '#EEF2FF',
  accentBorder: '#C7D2FE',
  userBubble: '#EEF2FF',
  agentBubble: '#FFFFFF',
  attachmentBubble: '#F8FAFC',
  text: '#1F2937',
  userText: '#1F2937',
  agentText: '#1F2937',
  textMuted: '#64748B',
};

function mergedTheme(theme?: MobileChatTheme) {
  return { ...defaultTheme, ...(theme || {}) };
}

function agentColor(id: string) {
  const colors = ['#6366F1', '#EC4899', '#14B8A6', '#F97316', '#8B5CF6', '#EF4444'];
  return colors[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % colors.length];
}

function isHumanSender(senderType: string, senderId: string) {
  const type = String(senderType || '').toLowerCase();
  const id = String(senderId || '').toLowerCase();
  return (
    type === 'human' ||
    type === 'user' ||
    type === 'me' ||
    type === 'self' ||
    id === 'human' ||
    id === 'user' ||
    id === 'me' ||
    id === 'self'
  );
}

function markdownStyles(t: Required<MobileChatTheme>, isUser: boolean) {
  const textColor = isUser ? t.userText : t.agentText;
  return {
    body: { color: textColor, fontSize: 15, lineHeight: 22, fontFamily: 'Inter' },
    code_inline: {
      backgroundColor: isUser ? 'rgba(255,255,255,0.22)' : '#F1F5F9',
      color: isUser ? textColor : '#334155',
      fontFamily: 'JetBrainsMono',
      fontSize: 13,
      paddingHorizontal: 4,
      borderRadius: 3,
    },
    code_block: {
      backgroundColor: isUser ? 'rgba(255,255,255,0.18)' : '#F1F5F9',
      color: isUser ? textColor : '#334155',
      fontFamily: 'JetBrainsMono',
      fontSize: 13,
      padding: 8,
      borderRadius: 6,
    },
    fence: {
      backgroundColor: isUser ? 'rgba(255,255,255,0.18)' : '#F1F5F9',
      color: isUser ? textColor : '#334155',
      fontFamily: 'JetBrainsMono',
      fontSize: 13,
      padding: 8,
      borderRadius: 6,
    },
    link: { color: isUser ? textColor : t.accent },
    heading1: { color: textColor, fontSize: 18, fontWeight: '700' as const, marginBottom: 4 },
    heading2: { color: textColor, fontSize: 16, fontWeight: '700' as const, marginBottom: 3 },
    heading3: { color: textColor, fontSize: 15, fontWeight: '700' as const, marginBottom: 2 },
    bullet_list_icon: { color: isUser ? textColor : t.accent },
    ordered_list_icon: { color: isUser ? textColor : t.accent },
  };
}

export function MobileMessageBubble({
  message,
  theme,
  roleLabels,
  formatTime,
}: {
  message: MobileChatMessage;
  theme?: MobileChatTheme;
  roleLabels?: { human?: string; agent?: string };
  formatTime?: (timestamp: string) => string;
}) {
  const t = mergedTheme(theme);
  const isUser = isHumanSender(message.senderType, message.senderId);
  const parsed = parseMessageContent(message.content);
  if (!parsed.displayText && parsed.attachments.length === 0) return null;
  const useMd = hasMarkdown(parsed.displayText);
  const senderLabel = isUser ? roleLabels?.human || 'You' : roleLabels?.agent || message.senderId;
  const avatarText = (senderLabel || message.senderId || '?').trim()[0]?.toUpperCase() || '?';
  const bubbleTheme = {
    accent: defaultTheme.accent,
    userBubble: defaultTheme.userBubble,
    agentBubble: defaultTheme.agentBubble,
    userText: defaultTheme.userText,
    agentText: defaultTheme.agentText,
    agentBorder: '#F3F4F6',
  };

  return (
    <View style={styles.msgRow}>
      <View
        style={[
          styles.agentAvatar,
          { backgroundColor: isUser ? bubbleTheme.accent : agentColor(message.senderId) },
        ]}
      >
        <Text style={styles.agentAvatarText}>{avatarText}</Text>
      </View>
      <View style={styles.bubbleColumn}>
        <Text style={[styles.senderLabel, { color: bubbleTheme.accent }]}>{senderLabel}</Text>
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: bubbleTheme.userBubble }]
              : [
                  styles.bubbleAgent,
                  { backgroundColor: bubbleTheme.agentBubble, borderColor: bubbleTheme.agentBorder },
                ],
          ]}
        >
          {parsed.displayText ? (
            useMd ? (
              <Markdown
                style={markdownStyles(
                  { ...t, userText: bubbleTheme.userText, agentText: bubbleTheme.agentText },
                  isUser,
                )}
              >
                {parsed.displayText}
              </Markdown>
            ) : (
              <Text
                style={[
                  styles.msgText,
                  { color: isUser ? bubbleTheme.userText : bubbleTheme.agentText },
                ]}
              >
                {parsed.displayText}
              </Text>
            )
          ) : null}
          <AttachmentList attachments={parsed.attachments} theme={t} />
          {message.timestamp && formatTime ? (
            <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function AttachmentList({
  attachments,
  theme,
}: {
  attachments: MessageAttachment[];
  theme?: MobileChatTheme;
}) {
  const t = mergedTheme(theme);
  if (!attachments.length) return null;
  return (
    <View style={styles.messageAttachmentList}>
      {attachments.map((attachment) => (
        <TouchableOpacity
          key={attachment.url}
          style={[
            styles.messageAttachmentCard,
            { backgroundColor: t.attachmentBubble, borderColor: t.accentBorder },
          ]}
          onPress={() => void Linking.openURL(attachment.url)}
        >
          {attachment.kind === 'image' ? (
            <Image source={{ uri: attachment.url }} style={styles.messageAttachmentImage} />
          ) : (
            <View style={[styles.messageAttachmentIcon, { backgroundColor: t.accentSoft }]}>
              <Ionicons name={attachmentIcon(attachment.kind)} size={18} color={t.accent} />
            </View>
          )}
          <View style={styles.messageAttachmentCopy}>
            <Text style={[styles.messageAttachmentLabel, { color: t.agentText }]} numberOfLines={1}>
              {attachment.label}
            </Text>
            <Text style={[styles.messageAttachmentKind, { color: t.textMuted }]}>
              {attachment.kind}
            </Text>
          </View>
          <Ionicons name="open-outline" size={16} color={t.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function buildContentWithAttachments(
  text: string,
  attachments: { token?: string | null | undefined }[] = [],
) {
  return [
    String(text || '').trim(),
    attachments
      .map((asset) => asset.token)
      .filter(Boolean)
      .join('\n\n'),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function MobilePendingAttachmentTray({
  attachments,
  uploading,
  uploadProgress,
  uploadError,
  onRemove,
  theme,
  uploadingLabel = 'Uploading',
  uploadFailedLabel = 'Upload failed',
}: {
  attachments: MobilePendingAttachment[];
  uploading?: boolean;
  uploadProgress?: number | null;
  uploadError?: string;
  onRemove?: (index: number) => void;
  theme?: MobileChatTheme;
  uploadingLabel?: string;
  uploadFailedLabel?: string;
}) {
  const t = mergedTheme(theme);
  if (!attachments.length && !uploading && !uploadError) return null;
  return (
    <View style={styles.pendingTray}>
      {attachments.map((asset, index) => (
        <View
          key={`${asset.url || asset.filename}-${index}`}
          style={[
            styles.pendingAttachmentChip,
            { backgroundColor: t.attachmentBubble, borderColor: t.accentBorder },
          ]}
        >
          {asset.kind === 'image' ? (
            <Image source={{ uri: asset.previewUrl || asset.url }} style={styles.pendingAttachmentImage} />
          ) : (
            <View style={[styles.pendingAttachmentIcon, { backgroundColor: t.accentSoft }]}>
              <Ionicons
                name={attachmentIcon(asset.kind as MessageAttachmentKind)}
                size={18}
                color={t.accent}
              />
            </View>
          )}
          <View style={styles.pendingAttachmentCopy}>
            <Text style={[styles.pendingAttachmentName, { color: t.text }]} numberOfLines={1}>
              {asset.filename || 'Attachment'}
            </Text>
            <Text style={[styles.pendingAttachmentKind, { color: t.textMuted }]}>
              {String(asset.kind || 'file').toUpperCase()}
            </Text>
          </View>
          {onRemove ? (
            <TouchableOpacity onPress={() => onRemove(index)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={t.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
      {uploading ? (
        <View style={[styles.pendingUploadRow, { backgroundColor: t.accentSoft }]}>
          <ActivityIndicator size="small" color={t.accent} />
          <Text style={[styles.pendingUploadText, { color: t.accent }]}>
            {uploadingLabel} {uploadProgress ?? 0}%
          </Text>
        </View>
      ) : null}
      {uploadError ? (
        <Text style={styles.pendingUploadError}>
          {uploadFailedLabel}: {uploadError}
        </Text>
      ) : null}
    </View>
  );
}

function attachmentIcon(kind: MessageAttachmentKind) {
  if (kind === 'audio') return 'musical-note-outline';
  if (kind === 'video') return 'videocam-outline';
  if (kind === 'preview') return 'globe-outline';
  if (kind === 'apk') return 'logo-android';
  return 'document-text-outline';
}

export function AgentRunStatusCard({
  status,
  sending,
  fallbackText = 'Agent is working',
  fallbackTitle = 'Agent',
  theme,
}: {
  status?: MobileRunStatus | null;
  sending?: boolean;
  fallbackText?: string;
  fallbackTitle?: string;
  theme?: MobileChatTheme;
}) {
  const t = mergedTheme(theme);
  if (!status && !sending) return null;
  if (!status) {
    return (
      <View style={[styles.runStatusCard, { borderColor: t.accentBorder, backgroundColor: t.accentSoft }]}>
        <View style={styles.runStatusHeader}>
          <ActivityIndicator color={t.accent} size="small" />
          <Text style={[styles.runStatusTitle, { color: t.text }]} numberOfLines={1}>
            {fallbackTitle}
          </Text>
          <Text style={[styles.runStatusBadge, { color: t.accent }]}>Agent</Text>
        </View>
        <Text style={[styles.runStatusLine, { color: t.textMuted }]}>{fallbackText}</Text>
      </View>
    );
  }
  const lines = status.statusLines?.length
    ? status.statusLines.slice(-5)
    : status.statusText
      ? [{ id: `${status.updatedAt || Date.now()}-status`, text: status.statusText }]
      : [];
  const kind = String(status.statusKind || '').toLowerCase();
  const isError = kind.includes('error') || kind.includes('fail');
  const isDone = kind.includes('done') || kind.includes('complete');

  return (
    <View
      style={[
        styles.runStatusCard,
        { borderColor: t.accentBorder, backgroundColor: t.accentSoft },
        isError ? styles.runStatusError : null,
      ]}
    >
      <View style={styles.runStatusHeader}>
        {isDone ? (
          <Ionicons name="checkmark-circle" size={17} color="#059669" />
        ) : isError ? (
          <Ionicons name="alert-circle" size={17} color="#DC2626" />
        ) : (
          <ActivityIndicator color={t.accent} size="small" />
        )}
        <Text style={[styles.runStatusTitle, { color: t.text }]} numberOfLines={1}>
          {status.agentName || status.agentId || fallbackTitle}
        </Text>
        <Text style={[styles.runStatusBadge, isError ? styles.runStatusBadgeError : { color: t.accent }]}>
          {runStatusKindLabel(status.statusKind)}
        </Text>
      </View>
      {status.adapter || status.model ? (
        <Text style={[styles.runStatusMeta, { color: t.textMuted }]} numberOfLines={1}>
          {[status.adapter, status.model].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {lines.map((line) => (
        <Text key={line.id} style={[styles.runStatusLine, { color: t.text }]} numberOfLines={2}>
          {line.text}
        </Text>
      ))}
    </View>
  );
}

export type MobileChatSurfaceProps = {
  messages: MobileChatMessage[];
  input: string;
  onInputChange: (text: string) => void;
  onSend: () => void;
  onAttachPress: () => void;
  onRemoveAttachment?: (index: number) => void;
  loading?: boolean;
  sending?: boolean;
  disabled?: boolean;
  uploading?: boolean;
  uploadProgress?: number | null;
  uploadError?: string;
  pendingAttachments?: MobilePendingAttachment[];
  runStatus?: MobileRunStatus | null;
  emptyTitle?: string;
  emptyText?: string;
  placeholder?: string;
  sendAccessibilityLabel?: string;
  attachAccessibilityLabel?: string;
  uploadLabel?: string;
  uploadFailedLabel?: string;
  runStatusFallbackTitle?: string;
  runStatusFallbackText?: string;
  roleLabels?: { human?: string; agent?: string };
  theme?: MobileChatTheme;
  backgroundColor?: string;
  surfaceColor?: string;
  borderColor?: string;
  placeholderColor?: string;
  formatTime?: (timestamp: string) => string;
  topContent?: any;
  bottomActions?: any;
  composerTopContent?: any;
  composerExtraLeftActions?: any;
  slashCommands?: MobileSlashCommand[];
  slashHintLabel?: string;
  onSlashCommandPress?: (command: MobileSlashCommand) => void;
  error?: string;
};

export function MobileChatSurface({
  messages,
  input,
  onInputChange,
  onSend,
  onAttachPress,
  onRemoveAttachment,
  loading,
  sending,
  disabled,
  uploading,
  uploadProgress,
  uploadError,
  pendingAttachments = [],
  runStatus,
  emptyTitle = 'No messages yet',
  emptyText = 'Start the conversation from here.',
  placeholder = 'Type a message...',
  sendAccessibilityLabel = 'Send message',
  attachAccessibilityLabel = 'Attach file',
  uploadLabel = 'Uploading',
  uploadFailedLabel = 'Upload failed',
  runStatusFallbackTitle = 'Agent',
  runStatusFallbackText = 'Agent is working',
  roleLabels,
  theme,
  backgroundColor = '#F8FAFC',
  surfaceColor = '#FFFFFF',
  borderColor = '#E2E8F0',
  placeholderColor = '#9CA3AF',
  formatTime,
  topContent,
  bottomActions,
  composerTopContent,
  composerExtraLeftActions,
  slashCommands = [],
  slashHintLabel = 'Slash commands',
  onSlashCommandPress,
  error,
}: MobileChatSurfaceProps) {
  let scrollView: ScrollView | null = null;
  const canSend = Boolean(input.trim() || pendingAttachments.length > 0);
  const filteredSlashCommands = filterMobileSlashCommands(input, slashCommands);

  return (
    <KeyboardAvoidingView
      style={[surfaceStyles.root, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={(node) => {
          scrollView = node;
        }}
        style={surfaceStyles.messages}
        contentContainerStyle={surfaceStyles.messageContent}
        onContentSizeChange={() => scrollView?.scrollToEnd({ animated: true })}
      >
        {loading ? (
          <View style={surfaceStyles.loading}>
            <ActivityIndicator color={theme?.accent || '#6366F1'} />
          </View>
        ) : null}
        {topContent}
        {messages.length === 0 && !loading ? (
          <View style={[surfaceStyles.empty, { backgroundColor: surfaceColor, borderColor }]}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={34}
              color={theme?.accent || '#6366F1'}
            />
            <Text style={[surfaceStyles.emptyTitle, { color: theme?.text || '#0F172A' }]}>
              {emptyTitle}
            </Text>
            <Text style={[surfaceStyles.emptyText, { color: theme?.textMuted || '#64748B' }]}>
              {emptyText}
            </Text>
          </View>
        ) : null}
        {messages.map((message) => (
          <MobileMessageBubble
            key={message.id}
            message={message}
            roleLabels={roleLabels}
            theme={theme}
            formatTime={formatTime}
          />
        ))}
        <AgentRunStatusCard
          status={runStatus}
          sending={sending}
          fallbackTitle={runStatusFallbackTitle}
          fallbackText={runStatusFallbackText}
          theme={theme}
        />
        {error ? <Text style={surfaceStyles.error}>{error}</Text> : null}
      </ScrollView>

      {bottomActions}

      {composerTopContent}
      <MobileSlashCommandSuggestions
        commands={filteredSlashCommands}
        label={slashHintLabel}
        theme={theme}
        surfaceColor={surfaceColor}
        borderColor={borderColor}
        onPress={(command) => {
          if (onSlashCommandPress) {
            onSlashCommandPress(command);
            return;
          }
          onInputChange(`${command.cmd} `);
        }}
      />

      {pendingAttachments.length > 0 || uploading || uploadError ? (
        <View
          style={[
            surfaceStyles.attachments,
            { backgroundColor: surfaceColor, borderTopColor: borderColor },
          ]}
        >
          <MobilePendingAttachmentTray
            attachments={pendingAttachments}
            uploading={uploading}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            onRemove={onRemoveAttachment}
            theme={theme}
            uploadingLabel={uploadLabel}
            uploadFailedLabel={uploadFailedLabel}
          />
        </View>
      ) : null}

      <View
        style={[
          surfaceStyles.composer,
          { backgroundColor: surfaceColor, borderTopColor: borderColor },
        ]}
      >
        <TouchableOpacity
          accessibilityLabel={attachAccessibilityLabel}
          style={[
            surfaceStyles.attachButton,
            { backgroundColor: theme?.accentSoft || '#EEF2FF' },
            uploading || disabled ? surfaceStyles.disabled : null,
          ]}
          onPress={onAttachPress}
          disabled={uploading || disabled}
        >
          <Ionicons name="add-circle-outline" size={23} color={theme?.accent || '#6366F1'} />
        </TouchableOpacity>
        {composerExtraLeftActions}
        <TextInput
          value={input}
          onChangeText={onInputChange}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          multiline
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={onSend}
          editable={!disabled}
          style={[
            surfaceStyles.input,
            {
              backgroundColor: theme?.attachmentBubble || '#F8FAFC',
              color: theme?.text || '#0F172A',
            },
          ]}
        />
        <TouchableOpacity
          accessibilityLabel={sendAccessibilityLabel}
          hitSlop={10}
          style={[
            surfaceStyles.send,
            { backgroundColor: theme?.accent || '#6366F1' },
            disabled || sending || uploading || !canSend ? surfaceStyles.sendDisabled : null,
          ]}
          disabled={disabled || sending || uploading || !canSend}
          onPress={onSend}
        >
          {sending ? (
            <ActivityIndicator size={18} color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export function MobileSlashCommandSuggestions({
  commands,
  label = 'Slash commands',
  onPress,
  theme,
  surfaceColor = '#FFFFFF',
  borderColor = '#E2E8F0',
}: {
  commands: MobileSlashCommand[];
  label?: string;
  onPress: (command: MobileSlashCommand) => void;
  theme?: MobileChatTheme;
  surfaceColor?: string;
  borderColor?: string;
}) {
  if (!commands.length) return null;
  const t = mergedTheme(theme);
  return (
    <View style={[surfaceStyles.slashPanel, { backgroundColor: surfaceColor, borderColor }]}>
      <View style={surfaceStyles.slashHeader}>
        <Ionicons name="terminal-outline" size={14} color={t.accent} />
        <Text style={[surfaceStyles.slashHeaderText, { color: t.textMuted }]}>{label}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={surfaceStyles.slashList}
        keyboardShouldPersistTaps="handled"
      >
        {commands.map((command) => (
          <TouchableOpacity
            key={`${command.cmd}:${command.skillId || command.family || ''}`}
            style={[surfaceStyles.slashChip, { backgroundColor: t.accentSoft, borderColor: t.accentBorder }]}
            onPress={() => onPress(command)}
          >
            <Text style={[surfaceStyles.slashCmd, { color: t.accent }]} numberOfLines={1}>
              {command.cmd}
            </Text>
            <Text style={[surfaceStyles.slashDesc, { color: t.textMuted }]} numberOfLines={1}>
              {command.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const surfaceStyles = StyleSheet.create({
  root: { flex: 1 },
  messages: { flex: 1 },
  messageContent: { padding: 16, paddingBottom: 18 },
  loading: { paddingVertical: 14 },
  empty: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  emptyTitle: { marginTop: 10, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  emptyText: { marginTop: 6, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  error: { marginTop: 10, color: '#B91C1C', fontWeight: '800' },
  attachments: {
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  slashPanel: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  slashHeaderText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  slashList: { gap: 8, paddingRight: 12 },
  slashChip: {
    width: 180,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  slashCmd: { fontSize: 13, fontWeight: '900' },
  slashDesc: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
  },
  attachButton: {
    width: 40,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 140,
    minHeight: 46,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.55 },
  disabled: { opacity: 0.55 },
});

const styles = StyleSheet.create({
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 4,
  },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 18,
  },
  agentAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
  bubbleColumn: { flex: 1, alignItems: 'stretch', minWidth: 0 },
  senderLabel: { fontSize: 12, marginBottom: 2, marginLeft: 2, fontWeight: '700' },
  bubble: { alignSelf: 'stretch', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleUser: { borderTopLeftRadius: 8 },
  bubbleAgent: { borderTopLeftRadius: 8, borderWidth: 1 },
  msgText: { fontSize: 15, lineHeight: 22 },
  messageAttachmentList: { gap: 8, marginTop: 8 },
  messageAttachmentCard: {
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    padding: 8,
  },
  messageAttachmentImage: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#E2E8F0' },
  messageAttachmentIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAttachmentCopy: { flex: 1, minWidth: 0 },
  messageAttachmentLabel: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  messageAttachmentKind: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  pendingTray: { gap: 8 },
  pendingAttachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pendingAttachmentImage: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#E2E8F0',
  },
  pendingAttachmentIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAttachmentCopy: { flex: 1, minWidth: 0 },
  pendingAttachmentName: { fontSize: 13, fontWeight: '900' },
  pendingAttachmentKind: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  pendingUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pendingUploadText: { fontSize: 12, fontWeight: '900' },
  pendingUploadError: { color: '#B91C1C', fontSize: 12, fontWeight: '900' },
  timestamp: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  runStatusCard: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 11,
    gap: 5,
  },
  runStatusError: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  runStatusHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  runStatusTitle: { flex: 1, fontSize: 13, fontWeight: '900' },
  runStatusBadge: {
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  runStatusBadgeError: { color: '#DC2626' },
  runStatusMeta: { fontSize: 11, fontWeight: '700' },
  runStatusLine: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
});
