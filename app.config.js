const appJson = require('./app.json');
const fs = require('node:fs');

module.exports = ({ config }) => {
  const base = appJson.expo || {};
  const variant = process.env.APP_VARIANT === 'china' ? 'china' : 'global';
  const isChina = variant === 'china';
  const envProjectId = (process.env.EAS_PROJECT_ID || '').trim();
  const fileProjectId = String(((base.extra || {}).eas || {}).projectId || '').trim();
  const resolvedProjectId = envProjectId || fileProjectId;
  const firebaseFile = (process.env.WTT_FIREBASE_ANDROID_JSON || '').trim();
  if (firebaseFile) {
    const firebase = JSON.parse(fs.readFileSync(firebaseFile, 'utf8'));
    const packageName = isChina ? 'com.waxbyte.wtt.cn' : 'com.waxbyte.wtt';
    if (!firebase.client?.some(client => client.client_info?.android_client_info?.package_name === packageName)) {
      throw new Error('Firebase Android configuration does not match this WTT package');
    }
  }

  return {
    ...base,
    ...config,
    name: isChina ? '我它它' : base.name,
    plugins: [
      ...((base.plugins || [])),
      ...((config?.plugins || [])),
      './plugins/withLocalizedAppName',
      './plugins/withBundledSpeechModels',
    ],
    ios: {
      ...(base.ios || {}),
      ...(config?.ios || {}),
      bundleIdentifier: isChina ? 'com.waxbyte.wtt.cn' : 'com.waxbyte.wtt',
    },
    android: {
      ...(base.android || {}),
      ...(config?.android || {}),
      package: isChina ? 'com.waxbyte.wtt.cn' : 'com.waxbyte.wtt',
      ...(firebaseFile ? { googleServicesFile: firebaseFile } : {}),
    },
    extra: {
      ...(base.extra || {}),
      ...(config?.extra || {}),
      appVariant: variant,
      eas: {
        ...((base.extra || {}).eas || {}),
        ...((config?.extra || {}).eas || {}),
        projectId: resolvedProjectId,
      },
      oauth: {
        ...((base.extra || {}).oauth || {}),
        ...((config?.extra || {}).oauth || {}),
        ...(isChina ? { googleClientId: '' } : {}),
      },
    },
  };
};
