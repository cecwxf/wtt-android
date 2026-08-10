import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useAudioRecorder, type AudioDataEvent } from '@siteed/expo-audio-studio';
import SherpaOnnx from '@siteed/sherpa-onnx.rn';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { PermissionsAndroid, Platform } from 'react-native';
import type { WebView as WebViewType } from 'react-native-webview';
import WttSpeechNative from 'wtt-speech-native';
import { deleteSpeechModel, ensureSpeechModel, speechModelStatus } from './model-manager';
import {
  parseSpeechCommand,
  WTT_SPEECH_EVENT,
  type SpeechCommand,
  type SpeechEvent,
} from './protocol';

export const nativeSpeechEnabled =
  Platform.OS === 'android' &&
  Boolean(WttSpeechNative) &&
  process.env.EXPO_PUBLIC_WTT_NATIVE_SPEECH_ENABLED !== '0';

function audioSamples(data: unknown) {
  if (data instanceof Float32Array) return data;
  if (Array.isArray(data)) return Float32Array.from(data.map(Number));
  if (typeof data !== 'string') return null;

  const binary = ReactNativeBlobUtil.base64.decode(data);
  const samples = new Float32Array(Math.floor(binary.length / 2));
  for (let index = 0; index < samples.length; index += 1) {
    const value =
      (binary.charCodeAt(index * 2) & 0xff) | ((binary.charCodeAt(index * 2 + 1) & 0xff) << 8);
    samples[index] = (value >= 0x8000 ? value - 0x10000 : value) / 0x8000;
  }
  return samples;
}

export function useNativeSpeechBridge(webViewRef: RefObject<WebViewType | null>) {
  const recorder = useAudioRecorder();
  const activeRef = useRef(false);
  const stoppingRef = useRef(false);
  const cancelledRef = useRef(false);
  const asrInitializedRef = useRef(false);
  const ttsInitializedRef = useRef(false);
  const lastPartialRef = useRef('');
  const feedQueueRef = useRef<Promise<void>>(Promise.resolve());
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emit = useCallback(
    (event: Omit<SpeechEvent, 'type'>) => {
      const payload: SpeechEvent = { type: WTT_SPEECH_EVENT, ...event };
      const serialized = JSON.stringify(JSON.stringify(payload));
      webViewRef.current?.injectJavaScript(`
        window.dispatchEvent(new CustomEvent('wtt-native-speech', {
          detail: JSON.parse(${serialized})
        }));
        true;
      `);
    },
    [webViewRef],
  );

  const reportStatus = useCallback(async () => {
    const status = await speechModelStatus();
    emit({ state: 'ready', asrReady: status.asrReady, ttsReady: status.ttsReady });
  }, [emit]);

  const ensureModel = useCallback(
    async (model: 'asr' | 'tts', allowDownload: boolean) => {
      const status = await speechModelStatus();
      const ready = model === 'asr' ? status.asrReady : status.ttsReady;
      const totalBytes = model === 'asr' ? status.asrBytes : status.ttsBytes;
      if (ready) {
        const localModel = await ensureSpeechModel(model, undefined, false);
        if (localModel) return localModel;
      }
      if (!allowDownload) {
        emit({ state: 'model-required', model, totalBytes });
        return null;
      }
      return ensureSpeechModel(
        model,
        (progress) => {
          emit({
            state: 'downloading',
            model,
            progress: progress.progress,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: progress.totalBytes,
          });
        },
        true,
      );
    },
    [emit],
  );

  const finishAsr = useCallback(
    async (cancelled: boolean) => {
      if (!activeRef.current && !stoppingRef.current) return;
      if (stoppingRef.current) return;
      stoppingRef.current = true;
      cancelledRef.current = cancelled;
      activeRef.current = false;
      if (maxDurationTimerRef.current) {
        clearTimeout(maxDurationTimerRef.current);
        maxDurationTimerRef.current = null;
      }
      try {
        await recorder.stopRecording().catch(() => null);
        await feedQueueRef.current.catch(() => undefined);
        if (cancelled) {
          await SherpaOnnx.ASR.resetStream().catch(() => undefined);
          emit({ state: 'cancelled' });
          return;
        }
        await SherpaOnnx.ASR.finishInput();
        const result = await SherpaOnnx.ASR.getResult();
        const text = String(result.text || lastPartialRef.current || '').trim();
        emit({ state: 'final', text });
        await SherpaOnnx.ASR.resetStream();
      } catch (error) {
        emit({ state: 'error', error: error instanceof Error ? error.message : String(error) });
      } finally {
        lastPartialRef.current = '';
        stoppingRef.current = false;
        cancelledRef.current = false;
        emit({ state: 'idle' });
      }
    },
    [emit, recorder],
  );

  const processAudio = useCallback(
    async (event: AudioDataEvent) => {
      if (!activeRef.current || cancelledRef.current) return;
      const samples = audioSamples(event.data);
      if (!samples) return;
      await SherpaOnnx.ASR.acceptWaveform(16_000, Array.from(samples));
      const result = await SherpaOnnx.ASR.getResult();
      const text = String(result.text || '').trim();
      if (text && text !== lastPartialRef.current) {
        lastPartialRef.current = text;
        emit({ state: 'partial', text });
      }
      const endpoint = await SherpaOnnx.ASR.isEndpoint();
      if (endpoint.isEndpoint && activeRef.current) {
        setTimeout(() => void finishAsr(false), 0);
      }
    },
    [emit, finishAsr],
  );

  const startAsr = useCallback(
    async (allowDownload: boolean) => {
      if (activeRef.current || stoppingRef.current) return;
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'WTT 语音输入',
            message: '语音识别在本机运行，需要使用麦克风。录音不会上传或保存。',
            buttonPositive: '允许',
            buttonNegative: '取消',
          },
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          emit({ state: 'cancelled', model: 'asr' });
          emit({ state: 'idle', model: 'asr' });
          return;
        }
      }
      const modelDir = await ensureModel('asr', allowDownload);
      if (!modelDir) return;
      emit({ state: 'initializing', model: 'asr' });
      if (!asrInitializedRef.current) {
        const result = await SherpaOnnx.ASR.initialize({
          modelDir,
          modelType: 'zipformer',
          streaming: true,
          numThreads: 2,
          decodingMethod: 'greedy_search',
          modelFiles: {
            encoder: 'encoder.onnx',
            decoder: 'decoder.onnx',
            joiner: 'joiner.onnx',
            tokens: 'tokens.txt',
          },
        });
        if (!result.success)
          throw new Error(result.error || 'Failed to initialize speech recognition');
        asrInitializedRef.current = true;
      }
      await SherpaOnnx.ASR.createOnlineStream();
      lastPartialRef.current = '';
      feedQueueRef.current = Promise.resolve();
      activeRef.current = true;
      try {
        await recorder.startRecording({
          sampleRate: 16_000,
          channels: 1,
          encoding: 'pcm_16bit',
          interval: 100,
          bufferDurationSeconds: 0.1,
          enableProcessing: false,
          output: { primary: { enabled: false } },
          keepAwake: true,
          onAudioStream: async (event) => {
            feedQueueRef.current = feedQueueRef.current.then(() => processAudio(event));
            await feedQueueRef.current;
          },
        });
      } catch (error) {
        activeRef.current = false;
        throw error;
      }
      maxDurationTimerRef.current = setTimeout(() => void finishAsr(false), 60_000);
      emit({ state: 'listening' });
    },
    [emit, ensureModel, finishAsr, processAudio, recorder],
  );

  const speak = useCallback(
    async (textRaw: string, allowDownload: boolean) => {
      const text = String(textRaw || '')
        .trim()
        .slice(0, 5_000);
      if (!text) return;
      const modelDir = await ensureModel('tts', allowDownload);
      if (!modelDir) return;
      const ttsModule = WttSpeechNative;
      if (!ttsModule) throw new Error('Local speech synthesis is unavailable');
      emit({ state: 'initializing', model: 'tts' });
      if (!ttsInitializedRef.current) {
        const result = await ttsModule.initializeTts({
          modelDir,
          modelFile: 'model.onnx',
          tokensFile: 'tokens.txt',
          lexiconFile: 'lexicon.txt',
          dictDir: `${modelDir}dict`,
          ruleFstsFile: `${modelDir}phone.fst,${modelDir}date.fst,${modelDir}number.fst`,
          numThreads: 2,
        });
        if (!result.success) throw new Error('Failed to initialize speech synthesis');
        ttsInitializedRef.current = true;
      }
      emit({ state: 'speaking' });
      const result = await ttsModule.speak(text, 0, 1);
      if (!result.success) throw new Error('Speech synthesis failed');
      emit({ state: 'idle' });
    },
    [emit, ensureModel],
  );

  const execute = useCallback(
    async (command: SpeechCommand) => {
      try {
        switch (command.command) {
          case 'status':
            await reportStatus();
            return;
          case 'start-asr':
            await startAsr(command.allowDownload === true);
            return;
          case 'stop-asr':
            await finishAsr(false);
            return;
          case 'cancel-asr':
            await finishAsr(true);
            return;
          case 'speak':
            await speak(command.text || '', command.allowDownload === true);
            return;
          case 'stop-speaking':
            WttSpeechNative?.stop();
            emit({ state: 'idle' });
            return;
          case 'delete-model':
            if (!command.model) return;
            if (command.model === 'asr' && asrInitializedRef.current) {
              await SherpaOnnx.ASR.release();
              asrInitializedRef.current = false;
            }
            if (command.model === 'tts' && ttsInitializedRef.current) {
              await WttSpeechNative?.release();
              ttsInitializedRef.current = false;
            }
            await deleteSpeechModel(command.model);
            await reportStatus();
        }
      } catch (error) {
        emit({ state: 'error', error: error instanceof Error ? error.message : String(error) });
      }
    },
    [emit, finishAsr, reportStatus, speak, startAsr],
  );

  const handleMessage = useCallback(
    (raw: string) => {
      if (!nativeSpeechEnabled) return false;
      try {
        const command = parseSpeechCommand(JSON.parse(raw));
        if (!command) return false;
        void execute(command);
        return true;
      } catch {
        return false;
      }
    },
    [execute],
  );

  useEffect(
    () => () => {
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      if (activeRef.current) void recorder.stopRecording().catch(() => null);
      if (asrInitializedRef.current) void SherpaOnnx.ASR.release().catch(() => undefined);
      if (ttsInitializedRef.current) void WttSpeechNative?.release().catch(() => undefined);
    },
    [recorder],
  );

  return { handleSpeechMessage: handleMessage, reportSpeechStatus: reportStatus };
}
