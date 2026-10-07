export const NATIVE_SESSION_MESSAGE = 'WTT_NATIVE_WEB_SESSION';

export function isTrustedAppUrl(raw: string, origin: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' &&
      url.origin === origin &&
      !url.username &&
      !url.password &&
      ['/mobile/feed', '/mobile/settings', '/mobile/login', '/login', '/feed', '/upgrade'].includes(
        url.pathname.replace(/\/+$/, ''),
      )
    );
  } catch {
    return false;
  }
}

type Credentials = { token: string; userId: string };
type Grant = { ticket: string; session_id: string; expires_in: number };
type Document = { url: string; nonce: string; generation: number };
type Pending = {
  requestId: string;
  token: string;
  userId: string;
  grant?: Grant;
  abort: AbortController;
  timer?: ReturnType<typeof setTimeout>;
};
type Message = {
  type: string;
  nonce: string;
  action: string;
  requestId: string;
  challenge?: string;
  ok?: boolean;
  userId?: string;
};
type Dependencies = {
  origin: string;
  apiUrl: string;
  credentials: () => Credentials | null;
  currentUrl: () => string;
  inject: (script: string) => void;
  signOut: () => Promise<void>;
  reportError: (message: string) => void;
  fetch?: typeof fetch;
};

// The native owner token never enters a generated script or a WebView message.
export class NativeWebSession {
  private document: Document | null = null;
  private pending: Pending | null = null;
  private generation = 0;
  private session: { id: string; token: string } | null = null;
  private signingOut = false;
  private readonly fetcher: typeof fetch;

  constructor(private readonly deps: Dependencies) {
    this.fetcher = deps.fetch || fetch;
  }

  invalidate() {
    this.generation++;
    this.document = null;
    const pending = this.pending;
    this.pending = null;
    pending?.abort.abort();
    if (pending?.timer) clearTimeout(pending.timer);
    if (pending?.grant) void this.revoke(pending.grant.session_id, pending.token);
  }

  credentialsChanged() {
    if (this.signingOut && !this.deps.credentials()) return;
    if (this.session && this.session.token !== this.deps.credentials()?.token) {
      void this.revoke(this.session.id, this.session.token);
      this.session = null;
    }
    this.invalidate();
  }

  openDocument(url: string, nonce: string): string | null {
    this.invalidate();
    if (!isTrustedAppUrl(url, this.deps.origin) || !/^[a-f0-9]{64}$/.test(nonce)) return null;
    this.document = { url, nonce, generation: this.generation };
    const credentials = this.deps.credentials();
    if (this.session?.token !== credentials?.token) this.session = null;
    return nativeWebSessionScript({
      origin: this.deps.origin,
      nonce,
      userId: credentials?.userId || '',
      sessionId: this.session?.id || '',
    });
  }

  private current(document: Document, pending?: Pending) {
    const credentials = this.deps.credentials();
    return (
      this.document === document &&
      this.generation === document.generation &&
      isTrustedAppUrl(this.deps.currentUrl(), this.deps.origin) &&
      (!pending ||
        (this.pending === pending &&
          credentials?.token === pending.token &&
          credentials?.userId === pending.userId))
    );
  }

  private async revoke(id: string, token: string) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10000);
    try {
      await this.fetcher(
        `${this.deps.apiUrl}/auth/mobile-web/sessions/${encodeURIComponent(id)}/revoke`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          signal: abort.signal,
          redirect: 'error',
        },
      );
    } catch {
      // A lost ticket is single-use and expires in 90 seconds. No raw credential is logged.
    } finally {
      clearTimeout(timer);
    }
  }

  private respond(document: Document, requestId: string, result: Record<string, unknown>) {
    if (!this.current(document)) return;
    this.deps
      .inject(`(function(){if(window.top!==window||location.origin!==${JSON.stringify(this.deps.origin)})return;
      var bridge=window.__WTT_NATIVE_SESSION__;if(bridge&&bridge.nonce===${JSON.stringify(document.nonce)})
      bridge.receive(${JSON.stringify(requestId)},${JSON.stringify(result)});})();true;`);
  }

  handle(raw: string, eventUrl: string): boolean {
    if (typeof raw !== 'string' || raw.length > 2048) return false;
    let message: Message;
    try {
      message = JSON.parse(raw);
    } catch {
      return false;
    }
    if (message?.type !== NATIVE_SESSION_MESSAGE) return false;
    const document = this.document;
    if (
      !document ||
      !this.current(document) ||
      !isTrustedAppUrl(eventUrl, this.deps.origin) ||
      message.nonce !== document.nonce ||
      !/^[a-f0-9]{32}$/.test(message.requestId || '')
    )
      return true;
    if (message.action === 'grant') {
      if (!/^[A-Za-z0-9_-]{43}$/.test(message.challenge || '') || this.pending || this.signingOut)
        return true;
      const credentials = this.deps.credentials();
      if (!credentials) {
        this.respond(document, message.requestId, { ok: false });
        return true;
      }
      const pending: Pending = {
        ...credentials,
        requestId: message.requestId,
        abort: new AbortController(),
      };
      this.pending = pending;
      void this.issue(document, pending, message.challenge!);
    } else if (message.action === 'result') {
      const pending = this.pending;
      if (!pending || pending.requestId !== message.requestId || !this.current(document, pending))
        return true;
      this.pending = null;
      if (pending.timer) clearTimeout(pending.timer);
      if (pending.grant && message.ok === true && message.userId === pending.userId) {
        const old = this.session;
        this.session = { id: pending.grant.session_id, token: pending.token };
        if (old && old.id !== this.session.id) void this.revoke(old.id, old.token);
        this.respond(document, message.requestId, { ok: true });
      } else if (pending.grant) {
        void this.revoke(pending.grant.session_id, pending.token);
        this.deps.reportError('登录接续失败，请重新加载或重新登录。');
      }
    } else if (message.action === 'sign-out' && !this.signingOut) {
      this.signingOut = true;
      this.pending?.abort.abort();
      if (this.pending?.timer) clearTimeout(this.pending.timer);
      this.pending = null;
      this.session = null;
      void this.deps
        .signOut()
        .then(() => this.respond(document, message.requestId, { ok: true }))
        .catch(() => this.respond(document, message.requestId, { ok: false }))
        .finally(() => {
          this.signingOut = false;
        });
    }
    return true;
  }

  private async issue(document: Document, pending: Pending, challenge: string) {
    const timeout = setTimeout(() => pending.abort.abort(), 12000);
    try {
      const response = await this.fetcher(`${this.deps.apiUrl}/auth/mobile-web/tickets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${pending.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_challenge: challenge, web_origin: this.deps.origin }),
        signal: pending.abort.signal,
        redirect: 'error',
      });
      if (!response.ok) throw new Error('Native grant failed');
      const grant: Grant = await response.json();
      if (
        !/^[A-Za-z0-9_-]{43}$/.test(grant.ticket || '') ||
        !/^[a-f0-9-]{36}$/.test(grant.session_id || '') ||
        !Number.isInteger(grant.expires_in) ||
        grant.expires_in < 1 ||
        grant.expires_in > 90
      )
        throw new Error('Invalid native grant');
      pending.grant = grant;
      if (!this.current(document, pending)) {
        await this.revoke(grant.session_id, pending.token);
        return;
      }
      this.respond(document, pending.requestId, { ok: true, ticket: grant.ticket });
      // Do not retain a pending grant forever if the page disappears during exchange.
      pending.timer = setTimeout(() => {
        if (this.pending !== pending) return;
        this.pending = null;
        void this.revoke(grant.session_id, pending.token);
      }, 20000);
    } catch {
      if (this.current(document, pending)) {
        this.pending = null;
        this.respond(document, pending.requestId, { ok: false });
        this.deps.reportError('登录接续失败，请检查网络后重试或重新登录。');
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function nativeWebSessionScript(config: {
  origin: string;
  nonce: string;
  userId: string;
  sessionId: string;
}): string {
  return `(function(){
    if(window.top!==window||location.origin!==${JSON.stringify(config.origin)})return;
    if(!${JSON.stringify(['/mobile/feed', '/mobile/settings', '/mobile/login', '/login', '/feed', '/upgrade'])}.includes(location.pathname.replace(/\\/+$/, '')))return;
    var previous=window.__WTT_NATIVE_SESSION__;if(previous&&previous.dispose)previous.dispose();
    var config=${JSON.stringify(config)}, disposed=false, pending=new Map(), active=false, lastCheck=0, expiryTimer, requests=new Set();
    try{localStorage.removeItem('__WTT_NATIVE_ACCESS_TOKEN__');}catch(e){}
    function random(size){var bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return Array.from(bytes,function(b){return b.toString(16).padStart(2,'0');}).join('');}
    function post(action,id,extra){if(disposed||window.top!==window||location.origin!==config.origin)return;
      window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({type:${JSON.stringify(NATIVE_SESSION_MESSAGE)},nonce:config.nonce,action:action,requestId:id},extra)));}
    function request(action,extra,id){id=id||random(16);return new Promise(function(resolve,reject){
      var timer=setTimeout(function(){pending.delete(id);reject(new Error('Native session timeout'));},15000);
      pending.set(id,{resolve:resolve,reject:reject,timer:timer});post(action,id,extra);
    });}
    async function json(url,options){var abort=new AbortController(),timer=setTimeout(function(){abort.abort();},12000);
      requests.add(abort);
      try{var response=await fetch(url,Object.assign({credentials:'include',cache:'no-store',signal:abort.signal},options));
      if(!response.ok)throw new Error('Session unavailable');return await response.json();}finally{clearTimeout(timer);requests.delete(abort);}}
    async function check(){
      if(disposed||active||!config.userId||document.visibilityState==='hidden'||Date.now()-lastCheck<60000)return;
      active=true;lastCheck=Date.now();var id;
      try{
        var session=await json('/api/auth/session');
        if(disposed)return;
        if(session.userId===config.userId&&config.sessionId&&session.mobileWebSessionId===config.sessionId&&session.accessToken){
          var me=await json('/api/wtt/auth/me',{headers:{Authorization:'Bearer '+session.accessToken}});
          if(me.user_id===config.userId){
            clearTimeout(expiryTimer);var remaining=Number(session.accessTokenExpiresAt)-Date.now();
            if(Number.isFinite(remaining))expiryTimer=setTimeout(function(){lastCheck=0;void check();},Math.max(1000,remaining+1000));
            return;
          }
        }
      }catch(e){if(disposed)return;}
      try{
        var bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
        var verifier=btoa(String.fromCharCode.apply(null,bytes)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
        var digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
        var challenge=btoa(String.fromCharCode.apply(null,digest)).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
        if(disposed)return;id=random(16);
        var grant=await request('grant',{challenge:challenge},id);if(disposed)return;
        if(!grant.ok)throw new Error('Native grant unavailable');
        var result=await json('/api/mobile/native-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:grant.ticket,code_verifier:verifier})});
        if(disposed)return;
        var ok=result.ok===true&&result.userId===config.userId;
        if(!ok)throw new Error('Session owner mismatch');
        await request('result',{ok:true,userId:result.userId},id);if(disposed)return;
        var destination=location.href;
        if(['/mobile/login','/login'].includes(location.pathname)){
          var callback=new URLSearchParams(location.search).get('callbackUrl')||'/mobile/feed';
          if(!callback.startsWith('/')||callback.startsWith('//'))callback='/mobile/feed';
          destination=new URL(callback,config.origin).toString();
          if(new URL(destination).origin!==config.origin)destination=config.origin+'/mobile/feed';
        }
        location.replace(destination);
      }catch(e){if(id&&!disposed)post('result',id,{ok:false});}
      finally{active=false;window.__WTT_NATIVE_SESSION_PENDING__=false;window.dispatchEvent(new Event('wtt-native-session-ready'));}
    }
    function resume(){void check();}
    var bridge={version:1,nonce:config.nonce,
      receive:function(id,result){var item=pending.get(id);if(!item||disposed)return;pending.delete(id);clearTimeout(item.timer);item.resolve(result);},
      signOut:async function(){config.userId='';var result=await request('sign-out');if(!result.ok)throw new Error('Native sign-out failed');},
      dispose:function(){disposed=true;pending.forEach(function(item){clearTimeout(item.timer);item.reject(new Error('Document closed'));});pending.clear();
        clearTimeout(expiryTimer);
        requests.forEach(function(abort){abort.abort();});requests.clear();
        window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);document.removeEventListener('visibilitychange',resume);}
    };
    window.__WTT_NATIVE_SESSION__=bridge;
    window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);document.addEventListener('visibilitychange',resume);
    void check();
  })();true;`;
}
