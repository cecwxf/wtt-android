export type SpeechModelFile = {
  path: string;
  url: string;
  size: number;
  sha256: string;
};

export type SpeechModelDefinition = {
  id: string;
  version: string;
  label: string;
  totalBytes: number;
  files: SpeechModelFile[];
};

export type SpeechModelManifest = {
  schemaVersion: 1;
  asr: SpeechModelDefinition;
  tts: SpeechModelDefinition;
};

const ASR_REVISION = '8e40c43232a1c5c66c82111efc5820d3accca11b';
const ASR_BASE = `https://huggingface.co/csukuangfj/sherpa-onnx-streaming-paraformer-bilingual-zh-en/resolve/${ASR_REVISION}`;
const TTS_REVISION = '5434a4bb4ce2cac232ef5714460f51068a7b886d';
// The quantized model was restored in a later revision; dictionary assets remain pinned separately.
const TTS_INT8_REVISION = 'a0d5c6a264c0ef92d70d8661d8cc502d79627cd6';
const TTS_BASE = `https://huggingface.co/csukuangfj/vits-melo-tts-zh_en/resolve/${TTS_REVISION}`;
const TTS_INT8_BASE = `https://huggingface.co/csukuangfj/vits-melo-tts-zh_en/resolve/${TTS_INT8_REVISION}`;

const asrFiles: SpeechModelFile[] = [
  {
    path: 'encoder.onnx',
    url: `${ASR_BASE}/encoder.int8.onnx`,
    size: 165_462_184,
    sha256: '81a70226a8934e6ed92aa1d4fc486b428b5398e2f2619ed4897b7294cab90e9a',
  },
  {
    path: 'decoder.onnx',
    url: `${ASR_BASE}/decoder.int8.onnx`,
    size: 71_664_561,
    sha256: 'f3cca9f77bb9d93c8fcbfb63ae617b6b1ee96818df3aa3b151c40658fe38594f',
  },
  {
    path: 'tokens.txt',
    url: `${ASR_BASE}/tokens.txt`,
    size: 75_756,
    sha256: '59aba8873a2ed1e122c25fee421e25f283b63290efbde85c1f01a853d83cb6e6',
  },
];

const ttsFiles: SpeechModelFile[] = [
  [
    'model.onnx',
    53_517_430,
    'f085f5079e05f039b800aeb542f5253c26a303211b0c6465d0d9387977855a63',
    `${TTS_INT8_BASE}/model.int8.onnx`,
  ],
  ['tokens.txt', 655, 'd18664a7e12bd7ea1022ddaf951e534e136815016c5a809d6b64156bffb4369d'],
  ['lexicon.txt', 6_837_622, '2b90dc30e293a54c2f08e7e9f6f6ff0b3107a2561364dd595a194754b8fbbf33'],
  ['phone.fst', 88_630, '1ac2b6fa56b1442320c4de7db08353bab8963a2b57f365eebcdd3a2d3562f8d7'],
  ['date.fst', 59_154, 'eb8aa079ae3cb81d8f4404992f39d61a0cb990947512b5b8d1e54d1f6980e718'],
  ['number.fst', 64_482, '743f402181fcfebf76cc2f0546b71fa26476e626fbe4e460fb7b4c3a7a8bd5bd'],
  ['dict/README.md', 683, '8bcc7c2ed7dff082d9a99c09de0bfd72249bf3b5c4298a3af328da40cbd8cfd1'],
  [
    'dict/hmm_model.utf8',
    519_739,
    'f17790586ac86dd048c8adffed052c4bd2b28ed0682972c1275e59040c0589a7',
  ],
  ['dict/idf.utf8', 5_998_717, 'dbd1e03d72b2263cc8d84a4304ed77677eed9e7deaf43a1a5133bbba9733b535'],
  [
    'dict/jieba.dict.utf8',
    5_071_204,
    '3043b77068e09c9904f27cad82f12b6ebe9dbdb5aeff3b25e45ab7f9c1122b55',
  ],
  [
    'dict/pos_dict/char_state_tab.utf8',
    327_139,
    '28b7be1dd7369766a51445af4d42e9a2ba4bf374c13be5bc1ca7721e27271dbb',
  ],
  [
    'dict/pos_dict/prob_emit.utf8',
    1_687_686,
    'c33c4cb7edf3b3a5947df7209b6e9f267eae1f21335d9e2bd2521ea07105457a',
  ],
  [
    'dict/pos_dict/prob_start.utf8',
    4_347,
    '13623ea0e9300bdb597cb2da28770b7b385d6c0098d66e516083fb01b6bd5d96',
  ],
  [
    'dict/pos_dict/prob_trans.utf8',
    124_159,
    'f22363e2307408293d180c6f9f6b5cb75879d52f722f7764fa2d3d0ae2400236',
  ],
  [
    'dict/stop_words.utf8',
    8_974,
    'b788b8a939d2e2fe079abd579ea98f12f9fb84370bfd0dddd81bb9381f7ab42c',
  ],
  ['dict/user.dict.utf8', 49, '495bbf49270408a1234690e1e6a97328f30a482a7a72aa769e8a12e8714b0c62'],
].map(([path, size, sha256, sourcePath]) => ({
  path: String(path),
  size: Number(size),
  sha256: String(sha256),
  url: String(sourcePath || path).startsWith('https://')
    ? String(sourcePath)
    : `${TTS_BASE}/${String(sourcePath || path)}`,
}));

export const bundledSpeechModelManifest: SpeechModelManifest = {
  schemaVersion: 1,
  asr: {
    id: 'paraformer-zh-en-int8',
    version: ASR_REVISION.slice(0, 12),
    label: '高准确率中英双语实时识别',
    totalBytes: asrFiles.reduce((total, file) => total + file.size, 0),
    files: asrFiles,
  },
  tts: {
    id: 'vits-melo-zh-en-int8',
    version: `${TTS_REVISION.slice(0, 12)}-${TTS_INT8_REVISION.slice(0, 12)}`,
    label: '中英双语本地朗读',
    totalBytes: ttsFiles.reduce((total, file) => total + file.size, 0),
    files: ttsFiles,
  },
};

function validFile(file: unknown): file is SpeechModelFile {
  if (!file || typeof file !== 'object') return false;
  const value = file as Partial<SpeechModelFile>;
  return Boolean(
    value.path &&
    !value.path.startsWith('/') &&
    !value.path.split('/').includes('..') &&
    value.url?.startsWith('https://') &&
    Number.isSafeInteger(value.size) &&
    Number(value.size) > 0 &&
    /^[a-f0-9]{64}$/i.test(String(value.sha256 || '')),
  );
}

function validModel(model: unknown): model is SpeechModelDefinition {
  if (!model || typeof model !== 'object') return false;
  const value = model as Partial<SpeechModelDefinition>;
  return Boolean(
    /^[a-z0-9._-]+$/i.test(String(value.id || '')) &&
    /^[a-z0-9._-]+$/i.test(String(value.version || '')) &&
    Array.isArray(value.files) &&
    value.files.length > 0 &&
    value.files.every(validFile),
  );
}

export async function loadSpeechModelManifest(): Promise<SpeechModelManifest> {
  const manifestUrl = String(process.env.EXPO_PUBLIC_WTT_SPEECH_MANIFEST_URL || '').trim();
  if (!manifestUrl) return bundledSpeechModelManifest;
  const response = await fetch(manifestUrl, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Speech manifest download failed: HTTP ${response.status}`);
  const manifest = (await response.json()) as Partial<SpeechModelManifest>;
  if (manifest.schemaVersion !== 1 || !validModel(manifest.asr) || !validModel(manifest.tts)) {
    throw new Error('Speech manifest is invalid');
  }
  return {
    schemaVersion: 1,
    asr: {
      ...manifest.asr,
      totalBytes: manifest.asr.files.reduce((total, file) => total + file.size, 0),
    },
    tts: {
      ...manifest.tts,
      totalBytes: manifest.tts.files.reduce((total, file) => total + file.size, 0),
    },
  };
}
