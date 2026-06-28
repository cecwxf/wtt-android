const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const ANDROID_LABELS = {
  'values-zh': '我它它',
  'values-zh-rCN': '我它它',
  'values-zh-rHK': '我它它',
  'values-zh-rTW': '我它它',
};

function upsertAppNameXml(existing, label) {
  const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const appName = `    <string name="app_name">${escaped}</string>`;
  if (!existing.trim()) {
    return `<resources>\n${appName}\n</resources>\n`;
  }
  if (existing.includes('name="app_name"')) {
    return existing.replace(/^\s*<string name="app_name">.*?<\/string>/m, appName);
  }
  return existing.replace(/<\/resources>\s*$/m, `${appName}\n</resources>\n`);
}

module.exports = function withLocalizedAppName(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const resRoot = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res');
      for (const [dirName, label] of Object.entries(ANDROID_LABELS)) {
        const dir = path.join(resRoot, dirName);
        const file = path.join(dir, 'strings.xml');
        fs.mkdirSync(dir, { recursive: true });
        const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        fs.writeFileSync(file, upsertAppNameXml(existing, label));
      }
      return modConfig;
    },
  ]);
};
