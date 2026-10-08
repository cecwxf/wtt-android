import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const appPath = path.resolve(process.argv[2] || 'build/ios-startup/WTT.app');
const evidence = path.resolve(process.argv[3] || 'build/ios-startup/evidence');
const version = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url))).expo.version;
const bundleId = 'com.waxbyte.wtt';
const xcrun = args => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', timeout: 180000 });
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Info.plist')], { encoding: 'utf8' }));
if (info.CFBundleIdentifier !== bundleId || info.CFBundleShortVersionString !== version) throw new Error('Simulator artifact version or identity mismatch');
const runtimes = JSON.parse(xcrun(['list', 'runtimes', '--json'])).runtimes
  .filter(runtime => runtime.isAvailable && runtime.identifier.includes('.iOS-'))
  .sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }));
const types = JSON.parse(xcrun(['list', 'devicetypes', '--json'])).devicetypes;
const deviceType = types.find(type => type.identifier === 'com.apple.CoreSimulator.SimDeviceType.iPhone-15');
if (!runtimes.length || !deviceType) throw new Error('An available iOS runtime and iPhone 15 simulator type are required');
const device = xcrun(['create', 'WTT-Standalone-Acceptance', deviceType.identifier, runtimes[0].identifier]).trim();
if (!/^[A-Fa-f0-9-]{36}$/.test(device)) throw new Error('Invalid simulator identity');
fs.mkdirSync(evidence, { recursive: true });
try {
  xcrun(['boot', device]);
  xcrun(['bootstatus', device, '-b']);
  xcrun(['install', device, appPath]);
  xcrun(['launch', '--terminate-running-process', device, bundleId]);
  await new Promise(resolve => setTimeout(resolve, 15000));
  const processes = xcrun(['spawn', device, 'launchctl', 'list']);
  const alive = processes.split('\n').some(line => {
    const [pid, , label] = line.trim().split(/\s+/);
    return Number(pid) > 0 && label?.includes(`UIKitApplication:${bundleId}[`);
  });
  if (!alive) throw new Error('Standalone app exited after launch');
  xcrun(['io', device, 'screenshot', '--type=png', path.join(evidence, 'startup.png')]);
  fs.writeFileSync(path.join(evidence, 'startup.json'), JSON.stringify({
    bundleId, version, buildNumber: info.CFBundleVersion, runtime: runtimes[0].version,
    deviceType: deviceType.name, configuration: 'Release', metroRequired: false,
    aliveAfterSeconds: 15, authenticationAndChatVerified: false,
  }, null, 2));
  console.log(`Standalone iOS ${version} installed and remains running. Login/chat are not verified by this startup check.`);
} finally {
  try { xcrun(['shutdown', device]); } catch {}
  xcrun(['delete', device]);
}
