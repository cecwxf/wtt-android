export const WTT_SPEECH_COMMAND = 'wtt-speech-command' as const;
export const WTT_SPEECH_EVENT = 'wtt-native-speech' as const;

export type SpeechModelKind = 'asr' | 'tts';

export type SpeechCommand =
  | { type: typeof WTT_SPEECH_COMMAND; command: 'status' }
  | { type: typeof WTT_SPEECH_COMMAND; command: 'start-asr'; allowDownload?: boolean }
  | { type: typeof WTT_SPEECH_COMMAND; command: 'stop-asr' | 'cancel-asr' }
  | { type: typeof WTT_SPEECH_COMMAND; command: 'speak'; text?: string; allowDownload?: boolean }
  | { type: typeof WTT_SPEECH_COMMAND; command: 'stop-speaking' }
  | { type: typeof WTT_SPEECH_COMMAND; command: 'delete-model'; model?: SpeechModelKind };

export type SpeechEvent = {
  type: typeof WTT_SPEECH_EVENT;
  state:
    | 'ready'
    | 'model-required'
    | 'downloading'
    | 'initializing'
    | 'listening'
    | 'partial'
    | 'final'
    | 'cancelled'
    | 'speaking'
    | 'idle'
    | 'error';
  model?: SpeechModelKind;
  text?: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  asrReady?: boolean;
  ttsReady?: boolean;
  error?: string;
};

export function parseSpeechCommand(value: unknown): SpeechCommand | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.type !== WTT_SPEECH_COMMAND || typeof record.command !== 'string') return null;
  return record as SpeechCommand;
}
export function nativeSpeechCapabilityScript(enabled: boolean, allowedHost: string): string {
  return `
    (function() {
      if (location.hostname.toLowerCase() !== ${JSON.stringify(allowedHost.toLowerCase())}) return true;
      window.__WTT_NATIVE_SPEECH__ = ${enabled ? "{ version: 1, platform: 'android' }" : 'null'};
      window.dispatchEvent(new CustomEvent('wtt-native-speech-ready', {
        detail: window.__WTT_NATIVE_SPEECH__
      }));
    })();
    true;
  `;
}
