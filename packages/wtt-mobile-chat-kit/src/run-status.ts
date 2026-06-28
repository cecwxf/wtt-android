export type AgentRunStatusLine = {
  id: string;
  text: string;
  kind?: string;
  ts: number;
};

export type AgentRunStatus = {
  topicId: string;
  agentId: string;
  agentName?: string;
  adapter?: string;
  model?: string;
  statusText?: string;
  statusKind?: string;
  statusLines: AgentRunStatusLine[];
  startedAt: number;
  updatedAt: number;
  expiresAt: number;
};

export type AgentRunStatusUpdate = Partial<Omit<AgentRunStatus, 'statusLines'>> & {
  topicId: string;
  statusText?: string;
  statusKind?: string;
  ttlMs?: number;
};

export type AgentRunMessage = {
  topic_id: string;
  sender_id: string;
  sender_type: string;
  content: string;
};

export type AgentRunStatusState<TMessage extends AgentRunMessage = AgentRunMessage> = {
  statusByTopic: Record<string, AgentRunStatus>;
  noteMessageSent: (topicId: string, agentId?: string) => void;
  handleWsEvent: (event: Record<string, unknown>) => void;
  handleIncomingMessage: (message: TMessage) => void;
  clearTopicStatus: (topicId: string) => void;
  pruneExpired: () => void;
};

export const AGENT_RUN_STALE_MS = 15 * 60 * 1000;
export const AGENT_RUN_COMPLETE_HOLD_MS = 2500;
const AGENT_RUN_MAX_LINES = 10;

type StoreSet<TMessage extends AgentRunMessage> = (
  partial:
    | Partial<AgentRunStatusState<TMessage>>
    | ((state: AgentRunStatusState<TMessage>) => Partial<AgentRunStatusState<TMessage>>),
) => void;

export function appendAgentRunStatus(
  existing: AgentRunStatus | undefined,
  update: AgentRunStatusUpdate,
  now = Date.now(),
): AgentRunStatus {
  const text = String(update.statusText || '').trim();
  const kind = String(update.statusKind || '').trim() || undefined;
  const lines = existing?.statusLines ? [...existing.statusLines] : [];

  if (text) {
    const last = lines[lines.length - 1];
    if (last && last.text === text && last.kind === kind) {
      lines[lines.length - 1] = { ...last, ts: now };
    } else {
      lines.push({ id: `${now}-${lines.length}-${kind || 'status'}`, text, kind, ts: now });
    }
  }

  return {
    topicId: update.topicId,
    agentId: update.agentId || existing?.agentId || '',
    agentName: update.agentName || existing?.agentName,
    adapter: update.adapter || existing?.adapter,
    model: update.model || existing?.model,
    statusText: text || existing?.statusText,
    statusKind: kind || existing?.statusKind,
    statusLines: lines.slice(-AGENT_RUN_MAX_LINES),
    startedAt: existing?.startedAt || now,
    updatedAt: now,
    expiresAt: now + (update.ttlMs || AGENT_RUN_STALE_MS),
  };
}

export function collectNestedRecords(
  value: unknown,
  out: Record<string, unknown>[] = [],
  depth = 0,
): Record<string, unknown>[] {
  if (!value || typeof value !== 'object' || depth > 3) return out;
  const record = value as Record<string, unknown>;
  out.push(record);
  for (const key of [
    'payload',
    'data',
    'event',
    'item',
    'message',
    'delta',
    'metadata',
    'detail',
  ]) {
    collectNestedRecords(record[key], out, depth + 1);
  }
  return out;
}

export function eventString(record: Record<string, unknown>, keys: string[]): string {
  const records = collectNestedRecords(record);
  for (const key of keys) {
    for (const source of records) {
      const value = source[key];
      if (value == null) continue;
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    }
  }
  return '';
}

export function statusTextFromTypingEvent(record: Record<string, unknown>): string | undefined {
  const direct = eventString(record, [
    'status_text',
    'statusText',
    'activity_text',
    'activityText',
    'message',
    'detail',
    'text',
    'summary',
    'description',
    'progress',
  ]);
  if (direct) return direct;
  const command = eventString(record, ['command', 'cmd', 'shell_command']);
  if (command) return `执行命令：${command}`;
  const tool = eventString(record, ['tool', 'tool_name', 'toolName', 'name']);
  if (tool) return `调用工具：${tool}`;
  const phase = eventString(record, ['phase', 'stage', 'step', 'status']);
  if (phase) return `阶段：${phase}`;
  return undefined;
}

export function statusKindFromTypingEvent(record: Record<string, unknown>): string | undefined {
  return (
    eventString(record, [
      'status_kind',
      'statusKind',
      'kind',
      'event_kind',
      'eventKind',
      'phase',
      'type',
      'status',
    ]) || undefined
  );
}

export function isTerminalRunStatusText(textRaw: unknown): boolean {
  const text = String(textRaw || '').trim().toLowerCase();
  if (!text) return false;
  return (
    /已完成\s*(turn|本轮执行|会话|输出)/i.test(text) ||
    /会话已完成|输出完成|agent 已回复/i.test(text) ||
    /completed\s*(turn|session|response)/i.test(text)
  );
}

export function parseTaskStatusContent(contentRaw: unknown, adapterRaw?: unknown) {
  const content = String(contentRaw || '').trim();
  if (!content.startsWith('[TASK_STATUS]')) return null;
  const action = taskStatusValue(content, 'action');
  const status = taskStatusValue(content, 'status');
  if (!action && !status) return null;

  const [group, detail = ''] = action.split(/:(.+)/);
  const kind = group || status || 'running';
  const actor = adapterDisplayName(adapterRaw);
  if (group === 'session') {
    if (detail.includes('thread.started') || detail.includes('turn.started')) {
      return { text: `${actor} 会话已启动`, kind: 'session' };
    }
    if (detail.includes('completed')) {
      return { text: `${actor} 会话已完成`, kind: 'session', terminal: true };
    }
    return { text: `${actor} 会话状态：${detail || status}`, kind: 'session' };
  }
  if (group === 'response') {
    const output = detail.trim();
    return {
      text: output ? `${actor} 输出：${output.slice(0, 90)}` : `${actor} 正在输出`,
      kind: 'response',
    };
  }
  if (group === 'command') {
    return { text: `${actor} 执行命令：${detail || status}`, kind: 'command' };
  }
  if (group === 'tool') {
    return { text: `${actor} 调用工具：${detail || status}`, kind: 'tool' };
  }
  return { text: `Agent 状态：${action || status}`, kind };
}

function taskStatusValue(content: string, key: string) {
  const pattern = new RegExp(
    `(?:^|\\s)${key}=([\\s\\S]*?)(?=\\s(?:time|status|action|task_id|topic_id|agent_id|progress|kind)=|$)`,
  );
  return content.match(pattern)?.[1]?.trim() || '';
}

export function parseMessageStreamStatus(raw: Record<string, unknown>) {
  if (raw.type !== 'message_stream') return null;
  const topicId = String(raw.topic_id || '').trim();
  const streamId = String(raw.stream_id || '').trim();
  const senderId = String(raw.sender_id || '').trim();
  const state = String(raw.state || '')
    .trim()
    .toLowerCase();
  if (!topicId || !streamId || !senderId) return null;
  if (state === 'error') {
    return {
      topicId,
      agentId: senderId,
      statusText: `执行失败：${String(raw.error || 'stream error')}`,
      statusKind: 'error',
      ttlMs: AGENT_RUN_STALE_MS,
    };
  }
  if (state === 'done') {
    return {
      topicId,
      agentId: senderId,
      statusText: 'Agent 输出完成',
      statusKind: 'response',
      ttlMs: AGENT_RUN_COMPLETE_HOLD_MS,
    };
  }
  if (state === 'delta' || state === 'snapshot' || state === 'start') {
    return {
      topicId,
      agentId: senderId,
      statusText: 'Agent 正在输出',
      statusKind: 'response',
      ttlMs: 60000,
    };
  }
  return null;
}

export function isExpiredRunStatus(status: AgentRunStatus | undefined, now = Date.now()) {
  return !status || status.expiresAt <= now;
}

export function runStatusKindLabel(kind?: string) {
  const normalized = String(kind || '').toLowerCase();
  if (normalized.includes('queued')) return '排队';
  if (normalized.includes('command')) return '命令';
  if (normalized.includes('tool')) return '工具';
  if (normalized.includes('response')) return '输出';
  if (normalized.includes('session')) return '会话';
  if (normalized.includes('complete') || normalized.includes('done')) return '完成';
  if (normalized.includes('error') || normalized.includes('fail')) return '异常';
  return '运行';
}

function adapterDisplayName(adapterRaw?: unknown): string {
  const adapter = String(adapterRaw || '').toLowerCase();
  if (adapter.includes('codex')) return 'Codex';
  if (adapter.includes('claude')) return 'Claude';
  if (adapter.includes('gemini')) return 'Gemini';
  if (adapter.includes('deepseek')) return 'DeepSeek';
  return 'Agent';
}

function messageRecord(event: Record<string, unknown>) {
  return event.message && typeof event.message === 'object'
    ? (event.message as Record<string, unknown>)
    : event;
}

export function createMobileAgentRunStatusStoreInitializer<
  TMessage extends AgentRunMessage = AgentRunMessage,
>() {
  return (set: StoreSet<TMessage>): AgentRunStatusState<TMessage> => ({
    statusByTopic: {},

    noteMessageSent: (topicId, agentId) => {
      if (!topicId) return;
      set((state) => ({
        statusByTopic: {
          ...state.statusByTopic,
          [topicId]: appendAgentRunStatus(state.statusByTopic[topicId], {
            topicId,
            agentId,
            statusText: '消息已发送，等待 Agent 接收',
            statusKind: 'queued',
            ttlMs: 45000,
          }),
        },
      }));
    },

    handleWsEvent: (event) => {
      const type = String(event.type || '');
      const now = Date.now();

      if (type === 'typing') {
        const topicId = String(event.topic_id || '').trim();
        if (!topicId) return;
        const agentId = String(event.agent_id || '').trim();
        const state = String(event.state || 'start').toLowerCase();
        if (state === 'stop') {
          set((current) => ({
            statusByTopic: {
              ...current.statusByTopic,
              [topicId]: appendAgentRunStatus(
                current.statusByTopic[topicId],
                {
                  topicId,
                  agentId,
                  statusText: 'Agent 已完成本轮执行',
                  statusKind: 'done',
                  ttlMs: AGENT_RUN_COMPLETE_HOLD_MS,
                },
                now,
              ),
            },
          }));
          return;
        }
        const statusText = statusTextFromTypingEvent(event) || 'Agent 正在工作';
        const statusKind = statusKindFromTypingEvent(event) || 'running';
        const isTerminal = isTerminalRunStatusText(statusText);
        const ttlRaw = Number(event.ttl_ms || 0);
        const ttlMs = isTerminal
          ? AGENT_RUN_COMPLETE_HOLD_MS
          : Number.isFinite(ttlRaw) && ttlRaw > 0
            ? Math.max(ttlRaw, 30000)
            : undefined;
        set((current) => ({
          statusByTopic: {
            ...current.statusByTopic,
            [topicId]: appendAgentRunStatus(
              current.statusByTopic[topicId],
              {
                topicId,
                agentId,
                agentName: String(event.agent_display_name || '') || undefined,
                adapter: String(event.adapter || '').trim() || undefined,
                model:
                  String(event.model || event.model_id || event.current_model || '').trim() ||
                  undefined,
                statusText,
                statusKind: isTerminal ? 'done' : statusKind,
                ttlMs,
              },
              now,
            ),
          },
        }));
        return;
      }

      const streamStatus = parseMessageStreamStatus(event);
      if (streamStatus) {
        set((current) => ({
          statusByTopic: {
            ...current.statusByTopic,
            [streamStatus.topicId]: appendAgentRunStatus(
              current.statusByTopic[streamStatus.topicId],
              streamStatus,
              now,
            ),
          },
        }));
        return;
      }

      const rec = messageRecord(event);
      const topicId = String(rec.topic_id || event.topic_id || '').trim();
      if (!topicId) return;
      const progress = parseTaskStatusContent(rec.content, event.adapter);
      if (!progress) return;
      const agentId = String(rec.sender_id || event.agent_id || '').trim();
      set((current) => ({
        statusByTopic: {
          ...current.statusByTopic,
          [topicId]: appendAgentRunStatus(
            current.statusByTopic[topicId],
            {
              topicId,
              agentId,
              statusText: progress.text,
              statusKind: progress.kind,
              ttlMs: 60000,
            },
            now,
          ),
        },
      }));
    },

    handleIncomingMessage: (message) => {
      if (!message.topic_id) return;
      const progress = parseTaskStatusContent(message.content);
      if (progress) {
        if (progress.terminal && message.sender_type === 'agent') {
          set((current) => ({
            statusByTopic: {
              ...current.statusByTopic,
              [message.topic_id]: appendAgentRunStatus(current.statusByTopic[message.topic_id], {
                topicId: message.topic_id,
                agentId: message.sender_id,
                statusText: progress.text,
                statusKind: 'done',
                ttlMs: AGENT_RUN_COMPLETE_HOLD_MS,
              }),
            },
          }));
          return;
        }
        set((current) => ({
          statusByTopic: {
            ...current.statusByTopic,
            [message.topic_id]: appendAgentRunStatus(current.statusByTopic[message.topic_id], {
              topicId: message.topic_id,
              agentId: message.sender_id,
              statusText: progress.text,
              statusKind: progress.kind,
              ttlMs: 60000,
            }),
          },
        }));
        return;
      }

      if (message.sender_type !== 'agent') return;
      set((current) => {
        const next = { ...current.statusByTopic };
        delete next[message.topic_id];
        return { statusByTopic: next };
      });
    },

    clearTopicStatus: (topicId) => {
      set((state) => {
        const next = { ...state.statusByTopic };
        delete next[topicId];
        return { statusByTopic: next };
      });
    },

    pruneExpired: () => {
      const now = Date.now();
      set((state) => {
        const next: Record<string, AgentRunStatus> = {};
        for (const [topicId, status] of Object.entries(state.statusByTopic)) {
          if (status.expiresAt > now) next[topicId] = status;
        }
        return { statusByTopic: next };
      });
    },
  });
}
