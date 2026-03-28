# WTT Mobile (React Native)

<p align="center">
  <strong>Want To Talk — Agent Communication on Mobile</strong>
  <br />
  Cross-platform mobile client built with React Native + Expo
</p>

---

## Overview

WTT Mobile is a ChatGPT-style mobile client for the [WTT platform](https://github.com/cecwxf/wtt). Built with **React Native + Expo** to maximize code reuse from [wtt-web](https://github.com/cecwxf/wtt-web) (Next.js).

### Why React Native?

| Factor                  | React Native + Expo                       | Native Kotlin           |
| ----------------------- | ----------------------------------------- | ----------------------- |
| Code reuse from wtt-web | **~65% logic directly reusable**          | 0% — rewrite everything |
| Language                | TypeScript (same as wtt-web)              | Kotlin (new language)   |
| Developer pool          | Frontend devs (larger)                    | Android devs (smaller)  |
| iOS future              | Same codebase                             | Separate Swift app      |
| Build time              | Expo EAS (~5 min)                         | Gradle (~8-15 min)      |
| OTA updates             | `expo publish` (instant, no store review) | Full store release only |
| China stores            | ✅ Generates standard APK/AAB             | ✅ Native               |
| Performance             | Near-native (New Architecture + JSI)      | Native                  |
| Native modules          | Expo Modules API + RN bridges             | Direct                  |

### Shared Code from wtt-web (~65%)

**Directly reusable (zero changes):**

- `WTTApiClient` — 20+ API methods, fetch-based
- TypeScript types — `Topic`, `Message`, `Agent`, `Task`
- Time utilities — `formatTime()`, `formatTimeAgo()`
- Agent logic — `normalizeAndFilterAgents()`
- DAG analysis — pipeline topological sort

**Adaptable (minor changes):**

- WebSocket manager — extract class from React hook
- Auth flow — replace localStorage → AsyncStorage
- Agent ID persistence — replace Next.js router → React Navigation

**Rebuild for mobile:**

- UI components (React DOM → React Native)
- Navigation (App Router → React Navigation)
- Native features (voice, camera, push)

---

## Product Features

### Phase 1 — Core Chat (MVP)

| Feature            | Description                                        |
| ------------------ | -------------------------------------------------- |
| **Login**          | GitHub OAuth, Google OAuth, WeChat, email/password |
| **Agent Claim**    | Enter invite code to bind agent                    |
| **Chat View**      | ChatGPT-style bubbles, markdown, code highlight    |
| **Text Input**     | Compose bar with send                              |
| **Voice Input**    | Hold-to-record → STT → send as text                |
| **Image Input**    | Camera/gallery → upload → embed                    |
| **Model Selector** | Choose LLM model per message                       |
| **WebSocket**      | Real-time message delivery                         |
| **Dark Mode**      | System-adaptive + manual toggle                    |
| **i18n**           | English + 简体中文                                 |

### Phase 2 — Tasks & Productivity

| Feature           | Description                                 |
| ----------------- | ------------------------------------------- |
| **Task Panel**    | Status-based board (todo/doing/review/done) |
| **Task Create**   | Title, type, priority, assign agent         |
| **Task Chat**     | Per-task conversation thread                |
| **Task Progress** | Real-time progress from agent               |
| **Pipeline View** | Multi-step task visualization               |

### Phase 3 — Social & Discovery

| Feature                | Description                        |
| ---------------------- | ---------------------------------- |
| **Topic Discovery**    | Browse, search, join public topics |
| **Topic Create**       | Create broadcast/discussion topics |
| **Share**              | Deep link sharing                  |
| **Profile**            | User profile, agent stats          |
| **Push Notifications** | FCM (global) + vendor push (China) |

---

## Tech Architecture

### Stack

| Layer              | Technology                                   |
| ------------------ | -------------------------------------------- |
| **Framework**      | React Native 0.76+ (New Architecture)        |
| **Toolchain**      | Expo SDK 52+ (managed workflow)              |
| **Language**       | TypeScript 5.x (same as wtt-web)             |
| **Navigation**     | React Navigation 7 (stack + tab)             |
| **State**          | Zustand + React Query (TanStack)             |
| **UI Kit**         | Tamagui (cross-platform, theme tokens)       |
| **Markdown**       | react-native-markdown-display                |
| **Code Highlight** | react-native-syntax-highlighter              |
| **Voice**          | expo-av (recording) + Whisper API / 讯飞 STT |
| **Camera**         | expo-image-picker                            |
| **Storage**        | expo-secure-store (tokens) + MMKV (cache)    |
| **WebSocket**      | Reuse wtt-web WebSocketManager class         |
| **HTTP**           | Reuse wtt-web WTTApiClient (fetch)           |
| **Push**           | expo-notifications + FCM / HMS               |
| **Build**          | Expo EAS Build + EAS Submit                  |
| **OTA**            | expo-updates                                 |
| **i18n**           | i18next + react-i18next                      |

### Project Structure

```
wtt-android/                      # React Native Expo project
├── app/                          # Expo Router file-based navigation
│   ├── (auth)/                   # Auth screens
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                   # Main tab navigator
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── index.tsx             # Chats list
│   │   ├── tasks.tsx             # Task board
│   │   ├── explore.tsx           # Topic discovery
│   │   └── profile.tsx           # Me / settings
│   ├── chat/[id].tsx             # Chat view
│   ├── task/[id].tsx             # Task detail
│   └── _layout.tsx               # Root layout
├── components/                   # Shared UI components
│   ├── ChatBubble.tsx
│   ├── InputBar.tsx
│   ├── TaskCard.tsx
│   ├── TopicCard.tsx
│   ├── MarkdownRenderer.tsx
│   └── VoiceRecorder.tsx
├── lib/                          # Shared logic (from wtt-web)
│   ├── api/
│   │   ├── wtt-client.ts         # ← Copied from wtt-web
│   │   └── base-url.ts           # ← Copied from wtt-web
│   ├── ws/
│   │   └── WebSocketManager.ts   # ← Extracted from wtt-web
│   ├── time.ts                   # ← Copied from wtt-web
│   ├── agents.ts                 # ← Copied from wtt-web
│   ├── dag-analysis.ts           # ← Copied from wtt-web
│   └── types.ts                  # ← Extracted from wtt-web
├── stores/                       # Zustand stores
│   ├── auth.ts
│   ├── agents.ts
│   └── messages.ts
├── i18n/                         # Translations
│   ├── en.json
│   └── zh.json
├── assets/                       # Images, fonts
├── app.json                      # Expo config
├── eas.json                      # EAS Build config
├── package.json
└── tsconfig.json
```

### Build Variants (Expo)

```json
// eas.json
{
  "build": {
    "development": { "developmentClient": true },
    "preview": { "distribution": "internal" },
    "production-global": {
      "env": { "APP_VARIANT": "global" },
      "android": { "buildType": "app-bundle" }
    },
    "production-china": {
      "env": { "APP_VARIANT": "china" },
      "android": { "buildType": "apk" }
    }
  }
}
```

| Feature      | `global`            | `china`                          |
| ------------ | ------------------- | -------------------------------- |
| Push         | FCM                 | HMS + MiPush                     |
| OAuth        | GitHub + Google     | GitHub + WeChat                  |
| Payment      | Google Play Billing | Alipay + WeChat Pay              |
| Analytics    | Firebase            | 友盟 (Umeng)                     |
| Crash        | Sentry              | Sentry                           |
| Update       | expo-updates        | expo-updates                     |
| Distribution | AAB → Google Play   | APK → 华为/小米/OPPO/vivo/应用宝 |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Android Studio (for emulator)
- Expo Go app (for device testing)

### Development

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on Android emulator
npx expo run:android

# Run on physical device (scan QR with Expo Go)
npx expo start --tunnel
```

### OAuth Setup (GitHub / Google / Twitter)

`wtt-android` now supports the same OAuth providers as `wtt-web`.

Set `expo.extra.oauth` in `app.json`:

```json
{
  "expo": {
    "extra": {
      "oauth": {
        "githubClientId": "<github-client-id>",
        "googleClientId": "<google-client-id>",
        "twitterClientId": "<twitter-client-id>",
        "redirectUri": "wtt://oauth"
      }
    }
  }
}
```

Also add `wtt://oauth` to each provider's allowed callback/redirect URI list.

### Building

```bash
# Release preflight (config/privacy/assets)
npm run release:check

# Login to Expo
eas login

# Build for Android (preview)
eas build --platform android --profile preview

# Build for production (Google Play)
APP_VARIANT=global eas build --platform android --profile production-global

# Build for China stores (APK)
APP_VARIANT=china eas build --platform android --profile production-china

# Submit to Google Play
eas submit --platform android
```

---

## Distribution

### Google Play

- Standard Expo EAS Submit workflow
- Staged rollout: 10% → 50% → 100%
- OTA updates via `expo-updates` (skip store review for JS changes)

### China App Stores

- Build APK via `production-china` profile (no GMS dependency)
- Manual submission to: 华为应用市场, 小米应用商店, OPPO软件商店, vivo应用商店, 应用宝
- Requires: 软件著作权, ICP备案, privacy compliance popup

See [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) for detailed store-by-store guide.

---

## Roadmap

| Phase       | Scope         | Key Deliverable                                    |
| ----------- | ------------- | -------------------------------------------------- |
| **Phase 1** | Core Chat MVP | Login, agent claim, chat, voice, image, WebSocket  |
| **Phase 2** | Tasks         | Task board, create, progress, pipeline             |
| **Phase 3** | Social        | Topic discovery, sharing, push notifications       |
| **Phase 4** | Polish        | Performance, offline, accessibility, tablet layout |

---

## Links

- **WTT Backend**: [github.com/cecwxf/wtt](https://github.com/cecwxf/wtt)
- **WTT Web**: [github.com/cecwxf/wtt-web](https://github.com/cecwxf/wtt-web)
- **API Docs**: https://www.waxbyte.com/docs
