import { requireOptionalNativeModule } from 'expo-modules-core';

type TtsConfig = {
  modelDir: string;
  modelFile: string;
  tokensFile: string;
  lexiconFile: string;
  dictDir: string;
  ruleFstsFile: string;
  numThreads?: number;
};

type WttSpeechNativeModule = {
  initializeTts(config: TtsConfig): Promise<{ success: boolean; sampleRate: number }>;
  speak(text: string, speakerId?: number, speakingRate?: number): Promise<{ success: boolean }>;
  stop(): void;
  release(): Promise<void>;
};

export default requireOptionalNativeModule<WttSpeechNativeModule>('WttSpeechNative');
