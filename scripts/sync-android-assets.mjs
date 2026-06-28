import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidResDir = path.join(rootDir, 'android/app/src/main/res');
const iconPath = path.join(rootDir, 'assets/images/icon.png');
const foregroundPath = path.join(rootDir, 'assets/images/adaptive-icon.png');
const splashPath = path.join(rootDir, 'assets/images/splash-icon.png');

if (!fs.existsSync(androidResDir)) {
  console.log('android/app/src/main/res not found; skip native asset sync');
  process.exit(0);
}

for (const source of [iconPath, foregroundPath, splashPath]) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing asset: ${path.relative(rootDir, source)}`);
  }
}

function resize(source, size, output) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  execFileSync('sips', ['-z', String(size), String(size), source, '--out', output], { stdio: 'ignore' });
}

function removeOldWebp(density) {
  for (const name of ['ic_launcher.webp', 'ic_launcher_round.webp', 'ic_launcher_foreground.webp']) {
    fs.rmSync(path.join(androidResDir, `mipmap-${density}`, name), { force: true });
  }
}

const launcherSizes = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];
const foregroundSizes = [
  ['mdpi', 108],
  ['hdpi', 162],
  ['xhdpi', 216],
  ['xxhdpi', 324],
  ['xxxhdpi', 432],
];
const splashSizes = [
  ['mdpi', 288],
  ['hdpi', 432],
  ['xhdpi', 576],
  ['xxhdpi', 864],
  ['xxxhdpi', 1152],
];

for (const [density, size] of launcherSizes) {
  removeOldWebp(density);
  const dir = path.join(androidResDir, `mipmap-${density}`);
  resize(iconPath, size, path.join(dir, 'ic_launcher.png'));
  resize(iconPath, size, path.join(dir, 'ic_launcher_round.png'));
}

for (const [density, size] of foregroundSizes) {
  resize(foregroundPath, size, path.join(androidResDir, `mipmap-${density}`, 'ic_launcher_foreground.png'));
}

for (const [density, size] of splashSizes) {
  resize(splashPath, size, path.join(androidResDir, `drawable-${density}`, 'splashscreen_logo.png'));
}

console.log('Android native assets synced from Expo assets');
