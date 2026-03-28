# Distribution Guide — WTT Mobile (React Native / Expo)

## Build System: Expo EAS

Expo Application Services (EAS) handles all builds in the cloud — no local Android SDK needed for CI.

### EAS Profiles

```json
// eas.json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production-global": {
      "env": { "APP_VARIANT": "global" },
      "android": { "buildType": "app-bundle" }
    },
    "production-china": {
      "env": { "APP_VARIANT": "china" },
      "android": { "buildType": "apk" }
    }
  },
  "submit": {
    "production": {
      "android": { "serviceAccountKeyPath": "./google-play-key.json" }
    }
  }
}
```

---

## Google Play

### Setup

1. Google Play Developer account ($25 one-time)
2. Create app in Play Console
3. Generate service account JSON for automated uploads

### Store Listing

- App icon: 512×512 PNG
- Feature graphic: 1024×500
- Screenshots: phone (min 2), 7" tablet, 10" tablet
- Short description (80 chars): "Chat with AI agents — voice, text, tasks"
- Privacy policy: https://www.waxbyte.com/privacy
- Content rating questionnaire

### Release Workflow

```bash
# Recommended one-click flow (with preflight + build + submit)
# (scripts support global eas or npx eas-cli)
EAS_PROJECT_ID=<your-project-id> GOOGLE_PLAY_KEY_PATH=./google-play-key.json npm run release:play

# Manual flow
APP_VARIANT=global eas build --platform android --profile production-global
eas submit --platform android --profile production

# Or: staged rollout via Play Console UI
# 10% → 50% → 100%
```

### OTA Updates (Skip Store Review)

For JavaScript-only changes (no native module changes):

```bash
# Push OTA update to all users
eas update --branch production --message "Fix chat rendering"
```

Users get the update on next app launch — no store re-review needed.

---

## China App Stores (国内应用商店)

### Prerequisites

#### 1. Software Copyright (软件著作权)

- Apply at: www.ccopyright.com.cn
- Processing: 30 working days (standard) / 3 days (expedited ~¥800)
- Required: source code first/last 30 pages, design docs
- Certificate name: "WTT智能通讯软件"

#### 2. ICP Filing (ICP备案)

- Domain waxbyte.com must have ICP备案
- Apply via cloud provider (Tencent Cloud / Aliyun)

#### 3. Privacy Compliance (隐私合规)

- First-launch privacy dialog (mandatory on all CN stores)
- List: all data collected, purposes, third-party SDKs
- User must explicitly agree before any data collection

### Store-by-Store

| Store            | URL                  | Review Time | Notes                        |
| ---------------- | -------------------- | ----------- | ---------------------------- |
| 华为应用市场     | developer.huawei.com | 1-3 days    | HMS SDK for push             |
| 小米应用商店     | dev.mi.com           | 1-3 days    | MiPush SDK                   |
| OPPO软件商店     | open.oppomobile.com  | 1-5 days    | —                            |
| vivo应用商店     | dev.vivo.com.cn      | 1-3 days    | —                            |
| 应用宝 (Tencent) | open.tencent.com     | 3-7 days    | Bugly integration encouraged |

All stores require: 软件著作权证书, real-name developer, privacy policy, **no GMS-only dependency**.

### China Build

```bash
# Recommended one-click flow (with preflight)
EAS_PROJECT_ID=<your-project-id> npm run release:china

# Manual flow
APP_VARIANT=china eas build --platform android --profile production-china

# Download APK, sign with local keystore, submit manually
```

### Feature Differences by Variant

| Feature    | `global`                  | `china`                                              |
| ---------- | ------------------------- | ---------------------------------------------------- |
| Push       | FCM (expo-notifications)  | HMS + vendor SDKs                                    |
| OAuth      | GitHub + Google + Twitter | GitHub + Twitter (Google disabled by variant config) |
| Payment    | Google Play Billing       | Alipay + WeChat Pay                                  |
| Analytics  | Firebase Analytics        | 友盟 (Umeng)                                         |
| Crash      | Sentry                    | Sentry                                               |
| Map        | Google Maps               | 高德 (Amap)                                          |
| OTA update | expo-updates              | expo-updates                                         |
| App ID     | com.waxbyte.wtt           | com.waxbyte.wtt.cn                                   |

### Variant Implementation (app.config.js)

```javascript
const variant = process.env.APP_VARIANT === 'china' ? 'china' : 'global';
const isChina = variant === 'china';

module.exports = ({ config }) => ({
  ...config,
  name: isChina ? 'WTT智能助手' : 'WTT',
  android: {
    ...(config.android || {}),
    package: isChina ? 'com.waxbyte.wtt.cn' : 'com.waxbyte.wtt',
  },
  extra: {
    ...(config.extra || {}),
    appVariant: variant,
    oauth: {
      ...((config.extra || {}).oauth || {}),
      ...(isChina ? { googleClientId: '' } : {}),
    },
  },
});
```

---

## CI/CD (GitHub Actions)

```yaml
# .github/workflows/build.yml
name: Build & Deploy
on:
  push:
    tags: ['v*']

jobs:
  build-global:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform android --profile production-global --non-interactive
      - run: eas submit --platform android --non-interactive

  build-china:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --platform android --profile production-china --non-interactive
      # China APK uploaded as release artifact for manual store submission
```

---

## Release Checklist

### First Release

- [ ] Expo project created and linked
- [ ] EAS Build configured
- [ ] Google Play Developer account
- [ ] Google Play service account JSON
- [ ] App icon + store listing assets
- [ ] Privacy policy at waxbyte.com/privacy
- [ ] Android keystore generated and backed up
- [ ] 软件著作权 applied (if targeting China)
- [ ] ICP备案 completed (if targeting China)

### Each Release

- [ ] Version bump in app.json
- [ ] Changelog updated
- [ ] `eas build` for target profiles
- [ ] Google Play: submit via EAS or Console
- [ ] China: download APK, test, submit manually
- [ ] OTA updates for JS-only hotfixes
