const appJson = require('./app.json');

module.exports = ({ config }) => {
  const base = appJson.expo || {};
  const variant = process.env.APP_VARIANT === 'china' ? 'china' : 'global';
  const isChina = variant === 'china';
  const envProjectId = (process.env.EAS_PROJECT_ID || '').trim();
  const fileProjectId = String(((base.extra || {}).eas || {}).projectId || '').trim();
  const resolvedProjectId = envProjectId || fileProjectId;

  return {
    ...base,
    ...config,
    name: isChina ? 'WTT智能助手' : base.name,
    ios: {
      ...(base.ios || {}),
      ...(config?.ios || {}),
      bundleIdentifier: isChina ? 'com.waxbyte.wtt.cn' : 'com.waxbyte.wtt',
    },
    android: {
      ...(base.android || {}),
      ...(config?.android || {}),
      package: isChina ? 'com.waxbyte.wtt.cn' : 'com.waxbyte.wtt',
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
