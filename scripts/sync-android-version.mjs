import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appJsonPath = path.join(rootDir, 'app.json');
const gradlePath = path.join(rootDir, 'android/app/build.gradle');

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const versionName = String(appJson.expo?.version || '').trim();
const versionCode = Number(appJson.expo?.android?.versionCode);

if (!versionName || !Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error('app.json must define expo.version and expo.android.versionCode');
}

if (!fs.existsSync(gradlePath)) {
  console.log('android/app/build.gradle not found; skip native version sync');
  process.exit(0);
}

const current = fs.readFileSync(gradlePath, 'utf8');
const next = current
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

if (next !== current) {
  fs.writeFileSync(gradlePath, next);
}

console.log(`Android native version synced: ${versionName} (${versionCode})`);
