import { isTrustedAppUrl } from '../auth/native-web-session';

export const NATIVE_FILES_MESSAGE = 'WTT_NATIVE_FILES';
export type FileRequest = { requestId: string; path: string; filename: string } & (
  { agentId: string; workspaceId?: never } | { workspaceId: string; agentId?: never }
);
export type FileProgress = { loaded: number; total: number };
type Document = { nonce: string; generation: number };
type Dependencies = {
  origin: string;
  currentUrl: () => string;
  inject: (script: string) => void;
  download: (request: FileRequest, current: () => boolean, progress: (value: FileProgress) => void) => Promise<void>;
  cancel: (requestId?: string) => void;
};

export class NativeFilesBridge {
  private document: Document | null = null;
  private generation = 0;
  private pending = new Set<string>();

  constructor(private readonly deps: Dependencies) {}

  invalidate() {
    this.generation++;
    this.document = null;
    this.pending.clear();
    this.deps.cancel();
  }

  openDocument(url: string, nonce: string) {
    this.invalidate();
    if (!isTrustedAppUrl(url, this.deps.origin) || !/^[a-f0-9]{64}$/.test(nonce)) return null;
    this.document = { nonce, generation: this.generation };
    return nativeFilesScript(this.deps.origin, nonce);
  }

  private current(document: Document) {
    return this.document === document && document.generation === this.generation
      && isTrustedAppUrl(this.deps.currentUrl(), this.deps.origin);
  }

  private emit(document: Document, requestId: string, result: Record<string, unknown>) {
    if (!this.current(document)) return;
    this.deps.inject(`(function(){if(window.top!==window||location.origin!==${JSON.stringify(this.deps.origin)})return;
      var bridge=window.__WTT_NATIVE_FILES__;if(bridge&&bridge.nonce===${JSON.stringify(document.nonce)})
      bridge.receive(${JSON.stringify(requestId)},${JSON.stringify(result)});})();true;`);
  }

  handle(raw: string, eventUrl: string) {
    if (typeof raw !== 'string' || raw.length > 8192) return false;
    let message: Record<string, unknown>;
    try { message = JSON.parse(raw); } catch { return false; }
    if (message?.type !== NATIVE_FILES_MESSAGE) return false;
    const document = this.document;
    const requestId = typeof message.requestId === 'string' ? message.requestId : '';
    if (!document || !this.current(document) || !isTrustedAppUrl(eventUrl, this.deps.origin)
      || message.nonce !== document.nonce || !/^[a-f0-9]{32}$/.test(requestId)) return true;
    if (message.action === 'cancel') {
      if (this.pending.has(requestId)) this.deps.cancel(requestId);
      return true;
    }
    if (message.action !== 'download') return true;
    if (this.pending.has(requestId)) return true;
    if (this.pending.size) { this.emit(document, requestId, { ok: false, code: 'busy' }); return true; }
    const agentId = typeof message.agentId === 'string' ? message.agentId : '';
    const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
    const hasAgent = message.agentId !== undefined;
    const hasWorkspace = message.workspaceId !== undefined;
    const validTarget = hasAgent !== hasWorkspace && (hasAgent
      ? /^agent-[a-f0-9]{12}$/.test(agentId)
      : /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(workspaceId));
    const filePath = typeof message.path === 'string' ? message.path : '';
    const filename = typeof message.filename === 'string' ? message.filename : '';
    if (!validTarget || !filePath || filePath.length > 4000
      || /^[\\/]/.test(filePath) || /^[A-Za-z]:/.test(filePath) || filePath.includes('\0')
      || filePath.split(/[\\/]/).includes('..') || !filename || filename.length > 255
      || filename === '.' || filename === '..' || /[\x00\\/]/.test(filename)) {
      this.emit(document, requestId, { ok: false, code: 'invalid_request' });
      return true;
    }
    this.pending.add(requestId);
    this.emit(document, requestId, { progress: { loaded: 0, total: 0 } });
    const target = hasWorkspace ? { workspaceId } : { agentId };
    void this.deps.download({ requestId, ...target, path: filePath, filename }, () => this.current(document), progress => {
      this.emit(document, requestId, { progress });
    }).then(() => this.emit(document, requestId, { ok: true }))
      .catch(error => this.emit(document, requestId, { ok: false, code: error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'download_failed' }))
      .finally(() => { if (this.current(document)) this.pending.delete(requestId); });
    return true;
  }
}

export function nativeFilesScript(origin: string, nonce: string) {
  return `(function(){
    if(window.top!==window||location.origin!==${JSON.stringify(origin)})return;
    var old=window.__WTT_NATIVE_FILES__;if(old&&old.dispose)old.dispose();
    var nonce=${JSON.stringify(nonce)},origin=${JSON.stringify(origin)},pending=new Map(),disposed=false;
    function post(action,id,extra){if(disposed||window.top!==window||location.origin!==origin)return;
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({type:${JSON.stringify(NATIVE_FILES_MESSAGE)},nonce:nonce,action:action,requestId:id},extra)));}
    window.__WTT_NATIVE_FILES__={version:2,nonce:nonce,
      download:function(args,onProgress){return new Promise(function(resolve,reject){
        if(disposed){reject(new Error('Document closed'));return;}
        if(pending.size){reject(new Error('File transfer busy'));return;}
        var acknowledgement=setTimeout(function(){post('cancel',args.requestId);clearTimeout(timer);pending.delete(args.requestId);reject(new Error('File bridge unavailable; reload and retry'));},10000);
        var timer=setTimeout(function(){post('cancel',args.requestId);clearTimeout(acknowledgement);pending.delete(args.requestId);reject(new Error('File transfer timeout'));},900000);
        pending.set(args.requestId,{resolve:resolve,reject:reject,timer:timer,acknowledgement:acknowledgement,progress:onProgress});post('download',args.requestId,args);
      });},
      cancel:function(id){post('cancel',id);var item=pending.get(id);if(item){clearTimeout(item.timer);clearTimeout(item.acknowledgement);pending.delete(id);item.reject(new Error('File transfer cancelled'));}},
      receive:function(id,result){var item=pending.get(id);if(!item||disposed)return;
        clearTimeout(item.acknowledgement);
        if(result.progress){if(item.progress)item.progress(result.progress);return;}
        pending.delete(id);clearTimeout(item.timer);if(result.ok)item.resolve();else {
          var error=new Error(result.code==='cancelled'?'File transfer cancelled':'Native file download failed');
          if(result.code==='cancelled')error.name='AbortError';item.reject(error);
        }
      },
      dispose:function(){disposed=true;pending.forEach(function(item){clearTimeout(item.timer);clearTimeout(item.acknowledgement);item.reject(new Error('Document closed'));});pending.clear();}
    };
  })();true;`;
}
