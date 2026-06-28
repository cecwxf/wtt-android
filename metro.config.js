const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const projectRoot = __dirname;
const mobileChatKitRoot = path.resolve(projectRoot, 'packages/wtt-mobile-chat-kit');

config.watchFolders = [...(config.watchFolders || []), mobileChatKitRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@wtt/mobile-chat-kit': mobileChatKitRoot,
  '@wtt/mobile-chat-kit/message-attachments': path.resolve(
    mobileChatKitRoot,
    'src/message-attachments.ts',
  ),
  '@wtt/mobile-chat-kit/history': path.resolve(mobileChatKitRoot, 'src/history.ts'),
  '@wtt/mobile-chat-kit/messages': path.resolve(mobileChatKitRoot, 'src/messages.ts'),
  '@wtt/mobile-chat-kit/upload': path.resolve(mobileChatKitRoot, 'src/upload.ts'),
  '@wtt/mobile-chat-kit/run-status': path.resolve(mobileChatKitRoot, 'src/run-status.ts'),
  '@wtt/mobile-chat-kit/attachment-options': path.resolve(
    mobileChatKitRoot,
    'src/attachment-options.ts',
  ),
  '@expo/vector-icons': path.resolve(projectRoot, 'node_modules/@expo/vector-icons'),
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react-native-markdown-display': path.resolve(
    projectRoot,
    'node_modules/react-native-markdown-display',
  ),
};

module.exports = withNativeWind(config, { input: './global.css' });
