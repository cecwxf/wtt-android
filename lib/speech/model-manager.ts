import * as FileSystem from 'expo-file-system';
import type { DownloadProgressData } from 'expo-file-system';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  loadSpeechModelManifest,
  type SpeechModelDefinition,
  type SpeechModelFile,
  type SpeechModelManifest,
} from './model-manifest';
import type { SpeechModelKind } from './protocol';

export type SpeechDownloadProgress = {
  model: SpeechModelKind;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
};

const MODEL_ROOT = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}wtt-speech/`;
let manifestPromise: Promise<SpeechModelManifest> | null = null;

function manifest() {
  manifestPromise ??= loadSpeechModelManifest().catch((error) => {
    manifestPromise = null;
    throw error;
  });
  return manifestPromise;
}

function definitionFor(source: SpeechModelManifest, kind: SpeechModelKind) {
  return source[kind];
}

function modelDirectory(kind: SpeechModelKind, definition: SpeechModelDefinition) {
  return `${MODEL_ROOT}${kind}/${definition.id}/${definition.version}/`;
}

function readyMarker(directory: string) {
  return `${directory}.ready.json`;
}

function manifestSignature(definition: SpeechModelDefinition) {
  return definition.files
    .map((file) => `${file.path}:${file.size}:${file.sha256.toLowerCase()}`)
    .join('|');
}

function nativePath(uri: string) {
  return uri.replace(/^file:\/\//, '');
}

async function ensureDirectoryFor(uri: string) {
  const parent = uri.slice(0, uri.lastIndexOf('/') + 1);
  await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
}

async function fileMatches(uri: string, file: SpeechModelFile, verifyHash: boolean) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory || Number(info.size || 0) !== file.size) return false;
  if (!verifyHash) return true;
  const digest = await ReactNativeBlobUtil.fs.hash(nativePath(uri), 'sha256');
  return digest.toLowerCase() === file.sha256.toLowerCase();
}

async function modelFilesPresent(directory: string, definition: SpeechModelDefinition) {
  try {
    const marker = JSON.parse(await FileSystem.readAsStringAsync(readyMarker(directory))) as {
      signature?: string;
    };
    if (marker.signature !== manifestSignature(definition)) return false;
  } catch {
    return false;
  }
  const checks = await Promise.all(
    definition.files.map((file) => fileMatches(`${directory}${file.path}`, file, false)),
  );
  return checks.every(Boolean);
}

export async function speechModelStatus() {
  const source = await manifest();
  const [asrReady, ttsReady] = await Promise.all(
    (['asr', 'tts'] as const).map(async (kind) => {
      const definition = definitionFor(source, kind);
      return modelFilesPresent(modelDirectory(kind, definition), definition);
    }),
  );
  return {
    asrReady,
    ttsReady,
    asrBytes: source.asr.totalBytes,
    ttsBytes: source.tts.totalBytes,
  };
}

export async function ensureSpeechModel(
  kind: SpeechModelKind,
  onProgress?: (progress: SpeechDownloadProgress) => void,
) {
  const source = await manifest();
  const definition = definitionFor(source, kind);
  const directory = modelDirectory(kind, definition);
  if (await modelFilesPresent(directory, definition)) return directory;

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  let completedBytes = 0;

  for (const file of definition.files) {
    const destination = `${directory}${file.path}`;
    if (await fileMatches(destination, file, true)) {
      completedBytes += file.size;
      onProgress?.({
        model: kind,
        progress: completedBytes / definition.totalBytes,
        downloadedBytes: completedBytes,
        totalBytes: definition.totalBytes,
      });
      continue;
    }

    await ensureDirectoryFor(destination);
    const temporary = `${destination}.download`;
    await FileSystem.deleteAsync(temporary, { idempotent: true });
    const task = FileSystem.createDownloadResumable(
      file.url,
      temporary,
      {},
      (event: DownloadProgressData) => {
        const current = Math.min(file.size, Number(event.totalBytesWritten || 0));
        onProgress?.({
          model: kind,
          progress: Math.min(1, (completedBytes + current) / definition.totalBytes),
          downloadedBytes: completedBytes + current,
          totalBytes: definition.totalBytes,
        });
      },
    );

    try {
      const result = await task.downloadAsync();
      if (!result?.uri || !(await fileMatches(result.uri, file, true))) {
        throw new Error(`Speech model checksum mismatch: ${file.path}`);
      }
      await FileSystem.deleteAsync(destination, { idempotent: true });
      await FileSystem.moveAsync({ from: result.uri, to: destination });
      completedBytes += file.size;
    } catch (error) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      throw error;
    }
  }

  await FileSystem.writeAsStringAsync(
    readyMarker(directory),
    JSON.stringify({
      id: definition.id,
      version: definition.version,
      signature: manifestSignature(definition),
      completedAt: Date.now(),
    }),
  );
  onProgress?.({
    model: kind,
    progress: 1,
    downloadedBytes: definition.totalBytes,
    totalBytes: definition.totalBytes,
  });
  return directory;
}

export async function deleteSpeechModel(kind: SpeechModelKind) {
  const source = await manifest();
  const definition = definitionFor(source, kind);
  await FileSystem.deleteAsync(modelDirectory(kind, definition), { idempotent: true });
}
