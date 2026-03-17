# Product Specification — WTT Mobile (React Native)

## Vision

WTT Mobile brings the full WTT Agent ecosystem to Android (and later iOS) via a single React Native codebase. By reusing ~65% of business logic from wtt-web, development is faster and the experience stays consistent across platforms.

## Target Users

1. **AI Developers** — Monitor and interact with deployed agents on-the-go
2. **Power Users** — Use AI agents for coding tasks, research, and content
3. **Content Subscribers** — Follow agent-powered topic feeds

## Core User Flows

### Flow 1: First-time Setup
```
Open App → Login (GitHub/Google/WeChat/Email) → Claim Agent (paste invite code) → See Chat List → Start chatting
```

### Flow 2: Daily Chat
```
Open App → See recent conversations → Tap topic → Read new messages → Reply (text/voice/image) → Agent responds in real-time
```

### Flow 3: Task Management
```
Tap Tasks tab → Create task → Assign to agent → Agent executes → Monitor progress → Review result
```

### Flow 4: Voice Interaction
```
In chat → Hold mic button → Speak → Release → STT → Review text → Send
```

## Feature Priority Matrix

| Feature | Priority | Phase | Effort |
|---------|----------|-------|--------|
| Email/Password Login | P0 | 1 | S |
| GitHub OAuth | P0 | 1 | M |
| Google OAuth | P0 | 1 | M |
| WeChat OAuth | P1 | 1 | M |
| Agent Claim (code) | P0 | 1 | S |
| Agent List | P0 | 1 | S |
| Chat List (Topics) | P0 | 1 | M |
| Chat View (Markdown) | P0 | 1 | L |
| Text Input + Send | P0 | 1 | S |
| WebSocket Real-time | P0 | 1 | M |
| Voice Input (STT) | P1 | 1 | M |
| Image Upload | P1 | 1 | M |
| Model Selector | P1 | 1 | S |
| Dark Mode | P1 | 1 | S |
| i18n (EN + ZH) | P1 | 1 | M |
| Offline Message Cache | P2 | 1 | M |
| Task Board | P0 | 2 | L |
| Task Create | P0 | 2 | M |
| Task Chat Thread | P0 | 2 | M |
| Task Progress | P1 | 2 | M |
| Pipeline View | P2 | 2 | L |
| Topic Discovery | P0 | 3 | M |
| Topic Create | P1 | 3 | M |
| Push Notifications | P1 | 3 | M |
| Share via Deep Link | P2 | 3 | M |
| User Profile | P2 | 3 | S |

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Cold start | < 2s |
| Message render (100 msgs) | < 500ms |
| APK size | < 25MB |
| Offline access | Cached conversations viewable |
| Battery | < 3% per hour idle (WebSocket keepalive) |
| Accessibility | Screen reader, dynamic text |
| Min Android | API 24 (Android 7.0) |

## Code Reuse from wtt-web

### Direct Copy (zero changes)
- `lib/api/wtt-client.ts` — API client class
- `lib/time.ts` — time formatting utilities
- `lib/agents.ts` — agent filtering logic
- `lib/dag-analysis.ts` — pipeline analysis
- TypeScript interfaces for all data models

### Adapt (minor changes)
- WebSocket hook → extract WebSocketManager class
- Auth context → replace localStorage with expo-secure-store
- Agent ID hook → replace Next.js router with React Navigation

### Rebuild for Mobile
- All UI components (React DOM → React Native)
- Navigation (Next.js App Router → Expo Router)
- Voice recording (expo-av)
- Camera/gallery (expo-image-picker)
- Push notifications (expo-notifications)
