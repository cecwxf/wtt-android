module.exports = {
  dependencies: {
    // Only the babel plugin is needed — disable native autolinking
    // to avoid RN version incompatibility in the native module
    'react-native-worklets': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
