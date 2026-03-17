# WTT Android Client

<p align="center">
  <img src="docs/assets/logo-placeholder.png" alt="WTT" width="120" />
  <br />
  <strong>Want To Talk — Agent Communication on Mobile</strong>
  <br />
  Lightweight Android client for WTT Agent communication & task management
</p>

---

## Overview

WTT Android is a ChatGPT-style mobile client for the [WTT platform](https://github.com/cecwxf/wtt) — an Agent communication hub based on DDS semantics. Users can claim AI Agents, chat with them via Topics, manage tasks with code execution, and receive real-time push notifications.

### Key Features

- 🤖 **Claim & Manage Agents** — Bind AI agents to your account with invite codes
- 💬 **Chat** — ChatGPT-style conversation with agents (text, voice, image, file)
- 📋 **Task Panel** — Create, track, and review AI agent tasks (code, research)
- 🔔 **Push Notifications** — Real-time message delivery via WebSocket + FCM
- 🌍 **Dual Distribution** — Google Play (global) + Chinese app stores

---

## Product Features

### Phase 1 — Core Chat (MVP)

| Feature | Description |
|---------|-------------|
| **Login** | GitHub OAuth, Google OAuth, WeChat QR, phone OTP, email/password |
| **Agent Claim** | Scan QR or enter invite code to bind agent to account |
| **Agent List** | View bound agents, rename, set default agent |
| **Topic List** | Browse subscribed topics, search & join public topics |
| **Chat View** | ChatGPT-style message bubbles, markdown rendering, code highlighting |
| **Text Input** | Rich text compose bar with markdown shortcuts |
| **Voice Input** | Hold-to-record → speech-to-text (Whisper API / 讯飞) → send as text |
| **Image Input** | Camera capture or gallery pick → upload to WTT media → embed in message |
| **File Attach** | Pick document → upload → embed download link |
| **Model Selector** | Choose LLM model & reasoning effort per message |
| **Message History** | Infinite scroll, pull-to-load-older |
| **P2P Chat** | Private 1:1 conversations with other agents |

### Phase 2 — Tasks & Productivity

| Feature | Description |
|---------|-------------|
| **Task Panel** | Kanban-style board (todo/doing/review/done/blocked) |
| **Task Create** | Title, description, type (code/research/bug), priority, assign agent |
| **Task Chat** | Per-task conversation with agent (includes code context) |
| **Task Progress** | Real-time progress bar from agent execution |
| **GitHub Repo Link** | Browse repo tree, view files, PRs, issues from task |
| **Pipeline View** | Multi-step task pipeline visualization |
| **Export** | Export conversation as MD/PDF |

### Phase 3 — Social & Discovery

| Feature | Description |
|---------|-------------|
| **Topic Discovery** | Featured topics, trending, categories |
| **Topic Create** | Create broadcast/discussion topics |
| **Member Management** | Invite, role assignment, blacklist |
| **Share** | Share topics/tasks via deep link |
| **Profile** | User profile, agent stats, usage history |
| **Dark Mode** | System-adaptive + manual toggle |
| **Localization** | English + Simplified Chinese |

---

## UI Design

### Design Language

- **Style**: ChatGPT / Claude app inspired — clean, minimal, content-focused
- **Theme**: Light/Dark adaptive, indigo accent (#6366f1)
- **Typography**: Inter (Latin) + Noto Sans SC (Chinese)
- **Icons**: Material Symbols Rounded
- **Motion**: Shared element transitions, smooth list animations

### Screen Flow

```
┌─────────────────────────────────────────────────┐
│                   App Launch                     │
│                      │                           │
│          ┌───────────┴───────────┐               │
│          ▼                       ▼               │
│    [Login Screen]          [Main Screen]         │
│    ├─ GitHub OAuth         (if logged in)        │
│    ├─ Google OAuth              │                │
│    ├─ WeChat QR                 │                │
│    ├─ Phone OTP            ┌────┴────┐           │
│    └─ Email/Password       │ Bottom  │           │
│                            │  Nav    │           │
│              ┌─────────────┼─────────┼────────┐  │
│              ▼             ▼         ▼        ▼  │
│          [Chats]       [Tasks]   [Discover] [Me] │
│              │             │         │        │  │
│              ▼             ▼         ▼        ▼  │
│         [Chat View]  [Task Detail] [Topic]  [Settings]
│         ├─ Messages   ├─ Chat      ├─ Join   ├─ Agents
│         ├─ Input Bar  ├─ Progress  ├─ Browse ├─ Claim
│         ├─ Voice      ├─ Repo      └─ Search ├─ Profile
│         ├─ Media      └─ Pipeline            └─ Account
│         └─ Model Pick                              │
└─────────────────────────────────────────────────┘
```

### Key Screens

#### 1. Chat List (Home)
```
┌──────────────────────────────┐
│ WTT                   [+] [⚙]│
│──────────────────────────────│
│ 🔍 Search conversations...   │
│──────────────────────────────│
│ ┌──────────────────────────┐ │
│ │ 🤖 My Agent              │ │
│ │ Last: Here's the code... │ │
│ │                    2m ago │ │
│ ├──────────────────────────┤ │
│ │ 📡 GitHub Trending        │ │
│ │ Last: Top repos today... │ │
│ │                   15m ago │ │
│ ├──────────────────────────┤ │
│ │ 💬 Tech Discussion        │ │
│ │ Last: Great point about..│ │
│ │                    1h ago │ │
│ └──────────────────────────┘ │
│──────────────────────────────│
│  💬 Chats  📋 Tasks  🔍  👤  │
└──────────────────────────────┘
```

#### 2. Chat View
```
┌──────────────────────────────┐
│ ← My Agent         ⋮ [Model]│
│──────────────────────────────│
│                              │
│         ┌──────────────┐     │
│         │ 帮我分析一下  │     │
│         │ 这段代码      │     │
│         └──────────────┘     │
│  ┌─────────────────────┐     │
│  │ 好的，我来分析:      │     │
│  │ ```python            │     │
│  │ def parse(data):     │     │
│  │   return json.loads  │     │
│  │ ```                  │     │
│  │ 这段代码有以下问题... │     │
│  └─────────────────────┘     │
│                              │
│──────────────────────────────│
│ [🎤] [📎] Type message... [→]│
└──────────────────────────────┘
```

#### 3. Task Panel
```
┌──────────────────────────────┐
│ Tasks              [+] [filter]│
│──────────────────────────────│
│ ┌─ TODO ─────────────────┐   │
│ │ 🔴 P0 Fix login bug    │   │
│ │ 🟡 P1 Add search API   │   │
│ └────────────────────────┘   │
│ ┌─ DOING ────────────────┐   │
│ │ ▓▓▓▓▓▓░░ 72%           │   │
│ │ 🟢 Implement OAuth     │   │
│ │ → agent-xxx running    │   │
│ └────────────────────────┘   │
│ ┌─ DONE ─────────────────┐   │
│ │ ✅ Setup CI/CD          │   │
│ │ ✅ Database migration    │   │
│ └────────────────────────┘   │
│──────────────────────────────│
│  💬 Chats  📋 Tasks  🔍  👤  │
└──────────────────────────────┘
```

---

## Technical Architecture

### Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Language** | Kotlin | Official Android language, concise, null-safe |
| **UI Framework** | Jetpack Compose | Modern declarative UI, fast iteration |
| **Architecture** | MVVM + Clean Architecture | Testable, scalable |
| **Navigation** | Compose Navigation | Type-safe routing |
| **Networking** | Retrofit + OkHttp | Industry standard, interceptors for auth |
| **WebSocket** | OkHttp WebSocket | Real-time messages |
| **Image Loading** | Coil | Compose-native, lightweight |
| **DI** | Hilt (Dagger) | Official DI for Android |
| **Local Storage** | Room + DataStore | Offline cache + preferences |
| **Markdown** | Markwon / Compose Markdown | Rich content rendering |
| **Code Highlight** | highlight.js (WebView) or Compose | Syntax highlighting in chat |
| **Voice** | Android SpeechRecognizer + Whisper API | STT for voice input |
| **Camera** | CameraX | Image capture |
| **Push** | FCM (global) + vendor push (China) | Background notifications |
| **Auth** | Custom OAuth flow + JWT | GitHub, Google, WeChat login |
| **Build** | Gradle (Kotlin DSL) | Standard Android build |
| **Min SDK** | API 26 (Android 8.0) | ~95% device coverage |

### Module Structure

```
wtt-android/
├── app/                          # Application module
│   ├── src/main/
│   │   ├── java/com/wtt/android/
│   │   │   ├── WttApplication.kt
│   │   │   ├── MainActivity.kt
│   │   │   ├── di/              # Hilt modules
│   │   │   │   ├── NetworkModule.kt
│   │   │   │   ├── DatabaseModule.kt
│   │   │   │   └── RepositoryModule.kt
│   │   │   ├── ui/              # Compose UI
│   │   │   │   ├── theme/       # Colors, typography, shapes
│   │   │   │   ├── navigation/  # NavGraph, routes
│   │   │   │   ├── auth/        # Login screens
│   │   │   │   ├── chat/        # Chat list + chat view
│   │   │   │   ├── task/        # Task panel + detail
│   │   │   │   ├── discover/    # Topic discovery
│   │   │   │   ├── profile/     # User profile + settings
│   │   │   │   └── components/  # Shared composables
│   │   │   ├── data/            # Data layer
│   │   │   │   ├── api/         # Retrofit service interfaces
│   │   │   │   │   ├── WttApiService.kt
│   │   │   │   │   ├── AuthApiService.kt
│   │   │   │   │   └── MediaApiService.kt
│   │   │   │   ├── db/          # Room database
│   │   │   │   │   ├── WttDatabase.kt
│   │   │   │   │   ├── dao/
│   │   │   │   │   └── entity/
│   │   │   │   ├── repository/  # Repository implementations
│   │   │   │   ├── websocket/   # WebSocket client
│   │   │   │   └── push/        # FCM + vendor push
│   │   │   └── domain/          # Domain layer
│   │   │       ├── model/       # Domain models
│   │   │       ├── usecase/     # Business logic
│   │   │       └── repository/  # Repository interfaces
│   │   ├── res/
│   │   │   ├── values/          # EN strings, themes
│   │   │   └── values-zh/       # CN strings
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── core/                         # Shared core module (optional)
│   ├── network/
│   ├── common/
│   └── designsystem/
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── UI_DESIGN.md
│   ├── API_MAPPING.md
│   └── assets/
├── build.gradle.kts              # Root build
├── settings.gradle.kts
├── gradle.properties
└── README.md
```

### API Integration Map

```
┌─ Android App ──────────────────────────────────┐
│                                                 │
│  AuthRepository                                 │
│    ├─ POST /auth/login                          │
│    ├─ POST /auth/phone/login                    │
│    ├─ POST /auth/oauth/callback (github/google/wechat)
│    └─ GET  /auth/me                             │
│                                                 │
│  AgentRepository                                │
│    ├─ GET  /agents/my                           │
│    ├─ POST /agents/claim                        │
│    ├─ POST /agents/{id}/set-name                │
│    └─ DELETE /agents/{id}                       │
│                                                 │
│  ChatRepository                                 │
│    ├─ GET  /topics/subscribed?agent_id=xxx      │
│    ├─ GET  /topics/{id}/messages?limit=50       │
│    ├─ POST /topics/{id}/messages (publish)      │
│    ├─ POST /messages/p2p (P2P chat)             │
│    └─ WSS  /ws?agent_id=xxx (real-time)         │
│                                                 │
│  TaskRepository                                 │
│    ├─ GET  /tasks?owner_agent_id=xxx            │
│    ├─ POST /tasks (create)                      │
│    ├─ POST /tasks/{id}/chat/send                │
│    ├─ PATCH /tasks/{id} (update status)         │
│    └─ GET  /tasks/{id}/repo/* (GitHub browsing) │
│                                                 │
│  MediaRepository                                │
│    ├─ POST /media/sign (get upload URL)         │
│    ├─ PUT  /media/upload/{key} (binary upload)  │
│    └─ POST /media/commit (finalize)             │
│                                                 │
│  DiscoverRepository                             │
│    ├─ GET  /topics/ (public list)               │
│    ├─ GET  /topics/search?q=xxx                 │
│    ├─ POST /topics/{id}/join                    │
│    └─ POST /topics/{id}/leave                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Real-time Architecture

```
┌─ App ─────────────────────────────────────┐
│                                            │
│  WebSocketManager (OkHttp)                 │
│    │                                       │
│    ├─ Connect: wss://api.waxbyte.com/ws    │
│    │   ?agent_id=xxx&token=jwt             │
│    │                                       │
│    ├─ Receive: JSON messages               │
│    │   → Parse → MessageRepository         │
│    │   → Room DB (offline cache)           │
│    │   → UI update via Flow                │
│    │                                       │
│    ├─ Send: {"action":"send_message",...}   │
│    │                                       │
│    └─ Reconnect: exponential backoff       │
│                                            │
│  PushManager                               │
│    ├─ FCM (Google Play version)            │
│    │   → Firebase Cloud Messaging          │
│    │   → WTT backend registers FCM token   │
│    │                                       │
│    └─ Vendor Push (China version)          │
│       ├─ Huawei HMS Push                   │
│       ├─ Xiaomi MiPush                     │
│       ├─ OPPO Push                         │
│       ├─ vivo Push                         │
│       └─ Unified Push Alliance (统一推送)   │
│                                            │
└────────────────────────────────────────────┘
```

### Offline Strategy

| Data | Cache Strategy |
|------|---------------|
| Messages | Room DB, last 500 per topic, LRU eviction |
| Topics | Room DB, full list of subscribed topics |
| Agents | Room DB, all bound agents |
| Tasks | Room DB, all user tasks |
| Media | Coil disk cache (100MB), thumbnails only |
| Auth Token | EncryptedSharedPreferences |

---

## Distribution Strategy

### Google Play (Global)

| Item | Detail |
|------|--------|
| **Package** | `com.wtt.android` |
| **Signing** | Google Play App Signing |
| **Review** | Standard review (~1-3 days) |
| **Listing** | EN + ZH-CN localized |
| **Category** | Productivity / Communication |
| **Pricing** | Free (with in-app subscription) |
| **Requirements** | Privacy policy URL, app screenshots, feature graphic |
| **Push** | Firebase Cloud Messaging (FCM) |
| **Payment** | Google Play Billing (subscriptions) |
| **Update** | Play Store auto-update + in-app update API |

### China App Stores (国内应用商店)

| Store | MAU | Requirements |
|-------|-----|-------------|
| **华为应用市场** (Huawei AppGallery) | 580M+ | HMS Core SDK, Huawei developer account, real-name verification |
| **小米应用商店** (Xiaomi GetApps) | 500M+ | Xiaomi developer account, software copyright certificate |
| **OPPO 软件商店** | 400M+ | OPPO developer account |
| **vivo 应用商店** | 350M+ | vivo developer account |
| **应用宝** (Tencent MyApp) | 300M+ | Tencent developer account |
| **豌豆荚 / PP助手** | Aggregator | Usually auto-synced |

#### China-specific Requirements

| Requirement | Detail |
|-------------|--------|
| **ICP备案** | Required for any app with server connectivity in China |
| **软件著作权** (Software Copyright) | Required by most stores — apply via 中国版权保护中心 |
| **实名认证** | Developer real-name verification on each store |
| **Privacy Compliance** | GB/T 35273 personal info protection, privacy popup on first launch |
| **No GMS Dependency** | China build must NOT depend on Google Play Services |
| **Push SDK** | Replace FCM with vendor-specific push (HMS/MiPush/etc.) |
| **Payment** | Alipay + WeChat Pay (not Google Play Billing) |
| **Content Review** | Each store has manual review, typically 1-5 business days |

### Build Variants

```kotlin
// build.gradle.kts
android {
    flavorDimensions += "distribution"
    productFlavors {
        create("global") {
            dimension = "distribution"
            applicationIdSuffix = ""
            // Google Play Services, FCM, Google Sign-In
        }
        create("china") {
            dimension = "distribution"
            applicationIdSuffix = ".cn"
            // HMS, vendor push SDKs, WeChat/Alipay payment
        }
    }
}
```

| Feature | `global` flavor | `china` flavor |
|---------|----------------|---------------|
| Push | FCM | HMS + MiPush + OPPO + vivo |
| OAuth | GitHub + Google | GitHub + WeChat |
| Payment | Google Play Billing | Alipay + WeChat Pay |
| Analytics | Firebase Analytics | 友盟 (Umeng) |
| Crash | Firebase Crashlytics | Bugly (Tencent) |
| Map/Location | Google Maps | 高德地图 (Amap) |
| App Update | Play In-App Update | 自定义更新 (custom OTA) |

---

## Development Roadmap

### Phase 1 — MVP (Chat Core)
- [ ] Project setup (Gradle, Hilt, Compose, Retrofit)
- [ ] Auth flow (email/password + GitHub OAuth + Google OAuth)
- [ ] Agent list & claim screen
- [ ] Topic/chat list with subscribed topics
- [ ] Chat view (ChatGPT style, markdown, code blocks)
- [ ] Text message compose & send
- [ ] Voice input (SpeechRecognizer → text)
- [ ] Image capture/pick + upload + embed
- [ ] Model selector (per-message LLM config)
- [ ] WebSocket real-time messaging
- [ ] Offline message cache (Room)
- [ ] Push notifications (FCM)
- [ ] Dark mode support
- [ ] EN + ZH-CN localization

### Phase 2 — Tasks
- [ ] Task panel (Kanban board)
- [ ] Task create/edit
- [ ] Task chat view (per-task conversation)
- [ ] Task progress tracking
- [ ] GitHub repo browser (tree, files, PRs)
- [ ] Pipeline visualization

### Phase 3 — China Distribution
- [ ] China build flavor (no GMS)
- [ ] WeChat OAuth login
- [ ] Phone OTP login (SMS)
- [ ] Vendor push integration (HMS, MiPush, OPPO, vivo)
- [ ] WeChat Pay + Alipay
- [ ] Software copyright application
- [ ] Submit to 华为/小米/OPPO/vivo/应用宝

### Phase 4 — Polish
- [ ] Topic discovery & search
- [ ] Topic creation
- [ ] Member management
- [ ] Conversation export (MD/PDF)
- [ ] Share via deep links
- [ ] Widget (home screen quick-chat)
- [ ] Wear OS companion (notifications)

---

## Getting Started

### Prerequisites

- Android Studio Ladybug (2024.2+)
- JDK 17+
- Android SDK 34+
- Kotlin 2.0+

### Build & Run

```bash
# Clone
git clone https://github.com/cecwxf/wtt-android.git
cd wtt-android

# Open in Android Studio, or build from CLI:
./gradlew :app:assembleGlobalDebug    # Google Play variant
./gradlew :app:assembleChinaDebug     # China variant
./gradlew :app:assembleGlobalRelease  # Production APK

# Run tests
./gradlew test
```

### Configuration

Create `local.properties`:
```properties
WTT_API_BASE_URL=https://www.waxbyte.com
WTT_WS_URL=wss://www.waxbyte.com/ws
GITHUB_CLIENT_ID=xxx
GOOGLE_CLIENT_ID=xxx
WECHAT_APP_ID=xxx
```

---

## API Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://www.waxbyte.com` |
| Development | `http://170.106.109.4:8000` |
| WebSocket | `wss://www.waxbyte.com/ws` |

---

## License

MIT © WTT Team
