#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const variant = process.env.APP_VARIANT === 'china' ? 'china' : 'global';

function readJson(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  console.log(`⚠️  ${msg}`);
}

function fail(msg) {
  console.log(`❌ ${msg}`);
}

let hasError = false;

const appJson = readJson('app.json');
if (!appJson?.expo) {
  fail('Missing app.json or app.json.expo');
  process.exit(1);
}

const expo = appJson.expo;
const envProjectId = (process.env.EAS_PROJECT_ID || '').trim();
const fileProjectId = String(expo?.extra?.eas?.projectId || '').trim();
const projectId = envProjectId || fileProjectId;
if (projectId) {
  ok(
    `EAS projectId is set (${String(projectId).slice(0, 8)}...)` +
      (envProjectId ? ' via env' : ' via app.json'),
  );
} else {
  hasError = true;
  fail('EAS projectId is empty. Set EAS_PROJECT_ID or app.json expo.extra.eas.projectId');
}

if (fs.existsSync(path.join(root, 'app.config.js'))) {
  ok('app.config.js exists (supports APP_VARIANT global/china)');
} else {
  hasError = true;
  fail('app.config.js missing');
}

if (fs.existsSync(path.join(root, 'app/(auth)/privacy-consent.tsx'))) {
  ok('First-launch privacy consent page exists');
} else {
  hasError = true;
  fail('Missing app/(auth)/privacy-consent.tsx');
}

const packageName = variant === 'china' ? 'com.waxbyte.wtt.cn' : 'com.waxbyte.wtt';
ok(`Target variant: ${variant} (expected package: ${packageName})`);

if (variant === 'global') {
  const keyPath = (process.env.GOOGLE_PLAY_KEY_PATH || 'google-play-key.json').trim();
  const resolvedKeyPath = path.isAbsolute(keyPath) ? keyPath : path.join(root, keyPath);
  if (fs.existsSync(resolvedKeyPath)) {
    ok(`Google Play key exists (${keyPath})`);
  } else {
    warn(`Google Play key not found at ${keyPath} (build is OK, auto-submit will fail)`);
  }
} else {
  ok('China variant selected; Google Play key is optional.');
}

const requiredAssets = [
  'assets/images/icon.png',
  'assets/images/adaptive-icon.png',
  'assets/images/splash-icon.png',
  'assets/images/favicon.png',
];
for (const rel of requiredAssets) {
  if (!fs.existsSync(path.join(root, rel))) {
    hasError = true;
    fail(`Missing asset: ${rel}`);
  }
}
if (!hasError) {
  ok('Core release checks passed.');
  process.exit(0);
}

console.log('\nRelease check failed. Fix items above and re-run: npm run release:check');
process.exit(1);
