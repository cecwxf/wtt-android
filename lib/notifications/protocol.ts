import { isTrustedAppUrl } from '../auth/native-web-session';

export const NOTIFICATION_MESSAGE = 'WTT_NATIVE_NOTIFICATIONS';
export type NotificationPreferences = { enabled: boolean; sound: boolean; preview: boolean };
export type NotificationSettings = NotificationPreferences & { granted: boolean };
export type ChatNotice = { userId: string; messageId: string; topicId: string; agentId: string; title: string; body: string; focused: boolean };
type Document = { nonce: string; generation: number };
type Dependencies = {
  origin: string;
  currentUrl(): string;
  userId(): string | null;
  inject(script: string): void;
  preferences(userId: string, current: () => boolean): Promise<NotificationSettings>;
  setPreferences(userId: string, value: NotificationPreferences, current: () => boolean): Promise<NotificationSettings>;
  show(value: ChatNotice, current: () => boolean): Promise<boolean>;
};
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,200}$/.test(value);

export class NativeNotificationsBridge {
  private document: Document | null = null;
  private generation = 0;
  private pending = new Set<string>();
  private saving = false;
  constructor(private readonly deps: Dependencies) {}

  invalidate() {
    this.generation++;
    this.document = null;
    this.pending.clear();
  }

  openDocument(url: string, nonce: string) {
    this.invalidate();
    if (!isTrustedAppUrl(url, this.deps.origin) || !/^[a-f0-9]{64}$/.test(nonce)) return null;
    this.document = { nonce, generation: this.generation };
    return notificationScript(this.deps.origin, nonce);
  }

  handle(raw: string, eventUrl: string) {
    if (typeof raw !== 'string' || raw.length > 8192) return false;
    let message: Record<string, unknown>;
    try { message = JSON.parse(raw); } catch { return false; }
    if (message?.type !== NOTIFICATION_MESSAGE) return false;
    const document = this.document;
    const userId = this.deps.userId();
    const requestId = message.requestId;
    if (!document || !identifier(userId) || message.userId !== userId
      || message.nonce !== document.nonce || !/^[a-f0-9]{32}$/.test(String(requestId))
      || !isTrustedAppUrl(eventUrl, this.deps.origin)) return true;
    const current = () => this.document === document && document.generation === this.generation
      && this.deps.userId() === userId && isTrustedAppUrl(this.deps.currentUrl(), this.deps.origin);
    if (!current() || this.pending.has(String(requestId))) return true;
    const respond = (result: Record<string, unknown>) => {
      if (!current()) return;
      this.deps.inject(`(function(){if(window.top!==window||location.origin!==${JSON.stringify(this.deps.origin)})return;
        var bridge=window.__WTT_NATIVE_NOTIFICATIONS__;if(bridge&&bridge.nonce===${JSON.stringify(document.nonce)})
        bridge.receive(${JSON.stringify(requestId)},${JSON.stringify(result)});})();true;`);
    };
    if (this.pending.size >= 8) { respond({ ok: false }); return true; }
    let operation: () => Promise<unknown>;
    if (message.action === 'preferences') operation = () => this.deps.preferences(userId, current);
    else if (message.action === 'setPreferences') {
      const value = message.value as Partial<NotificationPreferences> | undefined;
      if (this.saving || !value || typeof value.enabled !== 'boolean' || typeof value.sound !== 'boolean' || typeof value.preview !== 'boolean') {
        respond({ ok: false }); return true;
      }
      const preferences = { enabled: value.enabled, sound: value.sound, preview: value.preview };
      this.saving = true;
      operation = () => this.deps.setPreferences(userId, preferences, current);
    } else if (message.action === 'show') {
      const value = message.value as Partial<ChatNotice> | undefined;
      if (!value || value.userId !== userId || !identifier(value.messageId) || !identifier(value.topicId)
        || !identifier(value.agentId) || typeof value.title !== 'string' || value.title.length > 200
        || typeof value.body !== 'string' || value.body.length > 2000 || typeof value.focused !== 'boolean') {
        respond({ ok: false }); return true;
      }
      const notice = { ...value } as ChatNotice;
      operation = async () => ({ shown: await this.deps.show(notice, current) });
    } else return true;
    this.pending.add(String(requestId));
    void Promise.resolve().then(() => current() ? operation() : null)
      .then(value => respond({ ok: true, value })).catch(() => respond({ ok: false }))
      .finally(() => {
        if (message.action === 'setPreferences') this.saving = false;
        if (current()) this.pending.delete(String(requestId));
      });
    return true;
  }
}

export function notificationScript(origin: string, nonce: string) {
  return `(function(){
    if(window.top!==window||location.origin!==${JSON.stringify(origin)})return;
    var old=window.__WTT_NATIVE_NOTIFICATIONS__;if(old&&old.dispose)old.dispose();
    var nonce=${JSON.stringify(nonce)},origin=${JSON.stringify(origin)},pending=new Map(),disposed=false;
    function request(action,userId,value){return new Promise(function(resolve,reject){
      if(disposed||window.top!==window||location.origin!==origin||pending.size>=8){reject(new Error('Notification bridge unavailable'));return;}
      var bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
      var id=Array.from(bytes,function(b){return b.toString(16).padStart(2,'0');}).join('');
      var timer=setTimeout(function(){pending.delete(id);reject(new Error('Notification request timeout'));},60000);
      pending.set(id,{resolve:resolve,reject:reject,timer:timer});
      window.ReactNativeWebView.postMessage(JSON.stringify({type:${JSON.stringify(NOTIFICATION_MESSAGE)},nonce:nonce,requestId:id,action:action,userId:userId,value:value}));
    });}
    window.__WTT_NATIVE_NOTIFICATIONS__={version:1,nonce:nonce,
      preferences:function(userId){return request('preferences',userId);},
      setPreferences:function(userId,value){return request('setPreferences',userId,value);},
      show:function(value){return request('show',value.userId,value);},
      receive:function(id,result){var item=pending.get(id);if(!item||disposed)return;
        pending.delete(id);clearTimeout(item.timer);if(result.ok)item.resolve(result.value);else item.reject(new Error('Notification request failed'));},
      dispose:function(){disposed=true;pending.forEach(function(item){clearTimeout(item.timer);item.reject(new Error('Document closed'));});pending.clear();}
    };
    window.dispatchEvent(new Event('wtt-native-notifications-ready'));
  })();true;`;
}
