import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(rootDir, 'lib/speech/model-manifest.ts');
const assetRoot = path.join(rootDir, 'android/app/src/main/assets/wtt-speech');
const cacheRoot = path.resolve(
  process.env.WTT_SPEECH_MODEL_CACHE || path.join(os.homedir(), '.cache/wtt-speech-models'),
);

function loadManifest() {
  const source = fs.readFileSync(manifestPath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const loaded = { exports: {} };
  Function('module', 'exports', 'process', compiled)(loaded, loaded.exports, process);
  return loaded.exports.bundledSpeechModelManifest;
}

function digest(filePath) {
  const hash = crypto.createHash('sha256');
  const handle = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest('hex');
}

function validCachedFile(filePath, file) {
  try {
    return (
      fs.statSync(filePath).size === file.size && digest(filePath) === file.sha256.toLowerCase()
    );
  } catch {
    return false;
  }
}

function download(file, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.download`;
  fs.rmSync(temporary, { force: true });
  const result = spawnSync(
    'curl',
    ['--fail', '--location', '--retry', '4', '--retry-all-errors', '--output', temporary, file.url],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    fs.rmSync(temporary, { force: true });
    throw new Error(`Failed to download speech model file: ${file.path}`);
  }
  if (!validCachedFile(temporary, file)) {
    fs.rmSync(temporary, { force: true });
    throw new Error(`Speech model verification failed: ${file.path}`);
  }
  fs.renameSync(temporary, destination);
}

const manifest = loadManifest();
if (!manifest?.asr?.files?.length || !manifest?.tts?.files?.length) {
  throw new Error('Speech model manifest is empty');
}

fs.rmSync(assetRoot, { recursive: true, force: true });
for (const kind of ['asr', 'tts']) {
  const definition = manifest[kind];
  for (const file of definition.files) {
    const cachePath = path.join(cacheRoot, definition.id, definition.version, file.path);
    if (!validCachedFile(cachePath, file)) download(file, cachePath);
    const assetPath = path.join(assetRoot, kind, file.path);
    fs.mkdirSync(path.dirname(assetPath), { recursive: true });
    fs.copyFileSync(cachePath, assetPath);
  }
}

fs.writeFileSync(
  path.join(assetRoot, 'manifest.json'),
  JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    asr: manifest.asr.id,
    tts: manifest.tts.id,
  }),
);
console.log(
  `Bundled speech models prepared (${(
    (manifest.asr.totalBytes + manifest.tts.totalBytes) /
    1024 /
    1024
  ).toFixed(2)} MiB)`,
);
