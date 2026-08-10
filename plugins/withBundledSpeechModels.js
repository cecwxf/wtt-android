const path = require('path');
const { execFileSync } = require('child_process');
const { withDangerousMod } = require('@expo/config-plugins');

module.exports = function withBundledSpeechModels(config) {
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      execFileSync(process.execPath, [path.join(projectRoot, 'scripts/prepare-bundled-speech-models.mjs')], {
        cwd: projectRoot,
        stdio: 'inherit',
      });
      return modConfig;
    },
  ]);
};
