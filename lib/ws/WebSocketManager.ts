/**
 * Platform-agnostic WebSocket manager extracted from wtt-web.
 * Works in both React Native and browser environments.
 */

export interface WsMessage {
  type: string;
  request_id?: string;
  ok?: boolean;
  data?: unknown;
  error?: string;
  message?: {
    id: string;
    topic_id: string;
    sender_id: string;
    sender_type?: string;
    content_type?: string;
    semantic_type?: string;
    content: string;
    created_at: string;
  };
}

export type WsAction =
  | 'list' | 'find' | 'join' | 'leave' | 'subscribed'
  | 'publish' | 'poll' | 'p2p' | 'history' | 'detail';

export type WsState = 'connecting' | 'connected' | 'disconnected';

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface WebSocketManagerOptions {
  url: string;
  token?: string;
  onMessage?: (msg: WsMessage) => void;
  onStateChange?: (state: WsState) => void;
  heartbeatInterval?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  actionTimeout?: number;
}

let _reqCounter = 0;
function nextRequestId(): string {
  return `ws-${++_reqCounter}-${Date.now().toString(36)}`;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private retryCount = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Map<string, PendingRequest>();
  private destroyed = false;
  private opts: Required<WebSocketManagerOptions>;
  state: WsState = 'disconnected';

  constructor(options: WebSocketManagerOptions) {
    this.opts = {
      token: '',
      onMessage: () => {},
      onStateChange: () => {},
      heartbeatInterval: 30000,
      reconnectDelay: 2000,
      maxReconnectDelay: 30000,
      actionTimeout: 15000,
      ...options,
    };
  }

  private setState(s: WsState) {
    this.state = s;
    this.opts.onStateChange(s);
  }

  connect() {
    if (this.destroyed || !this.opts.url) return;
    this.cleanup();
    this.setState('connecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.opts.url);
    } catch {
      this.setState('disconnected');
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      if (this.destroyed) { ws.close(); return; }
      if (this.opts.token) {
        ws.send(JSON.stringify({ action: 'auth', token: this.opts.token }));
      }
      this.setState('connected');
      this.retryCount = 0;
      this.heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, this.opts.heartbeatInterval);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (event.data === 'pong') return;
      try {
        const parsed: WsMessage = JSON.parse(event.data);
        if (parsed.type === 'action_result' && parsed.request_id) {
          const p = this.pending.get(parsed.request_id);
          if (p) {
            clearTimeout(p.timer);
            this.pending.delete(parsed.request_id);
            if (parsed.ok) p.resolve(parsed.data);
            else p.reject(new Error(parsed.error || 'Action failed'));
            return;
          }
        }
        this.opts.onMessage(parsed);
      } catch { /* ignore non-JSON */ }
    };

    ws.onclose = () => {
      this.setState('disconnected');
      if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
      this.pending.forEach((p) => { clearTimeout(p.timer); p.reject(new Error('WebSocket disconnected')); });
      this.pending.clear();
      if (this.destroyed) return;
      const delay = Math.min(
        this.opts.reconnectDelay * Math.pow(1.5, this.retryCount),
        this.opts.maxReconnectDelay,
      );
      this.retryCount++;
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };

    ws.onerror = () => { /* onclose fires next */ };
  }

  async sendAction<T = unknown>(action: WsAction, payload?: Record<string, unknown>): Promise<T | null> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return null;
    const requestId = nextRequestId();
    const msg = JSON.stringify({ action, request_id: requestId, ...payload });

    return new Promise<T | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`WS action '${action}' timed out`));
      }, this.opts.actionTimeout);

      this.pending.set(requestId, {
        resolve: resolve as (data: unknown) => void,
        reject,
        timer,
      });
      this.ws!.send(msg);
    });
  }

  updateToken(token: string) {
    this.opts.token = token;
    if (this.ws?.readyState === WebSocket.OPEN && token) {
      this.ws.send(JSON.stringify({ action: 'auth', token }));
    }
  }

  private cleanup() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.pending.forEach((p) => { clearTimeout(p.timer); p.reject(new Error('WebSocket closed')); });
    this.pending.clear();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      if (this.ws.readyState <= 1) this.ws.close();
      this.ws = null;
    }
  }

  destroy() {
    this.destroyed = true;
    this.cleanup();
  }
}
