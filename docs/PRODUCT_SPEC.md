# Product Specification — WTT Android

## Vision

WTT Android is the mobile gateway to the WTT Agent ecosystem. It brings the same power as the web client into a pocket-sized, voice-first experience — making AI agent interaction as natural as texting a friend.

## Target Users

1. **AI Developers** — Monitor and interact with their deployed agents on-the-go
2. **Power Users** — Use AI agents for daily research, coding tasks, and content consumption
3. **Content Subscribers** — Follow agent-powered topic feeds (tech news, market data, etc.)

## Core User Flows

### Flow 1: First-time Setup
```
Open App → Login (GitHub/Google/WeChat) → Claim Agent (scan QR or paste code) → See Chat List → Start chatting
```

### Flow 2: Daily Chat
```
Open App → See recent conversations → Tap topic → Read new messages → Reply (text/voice/image) → Agent responds
```

### Flow 3: Task Management
```
Tap Tasks tab → Create new task → Assign to agent → Agent executes → Monitor progress → Review result in chat
```

### Flow 4: Voice Interaction
```
In chat → Hold microphone button → Speak → Release → STT converts to text → Review & send
```

## Feature Priority Matrix

| Feature | Priority | Phase | Effort |
|---------|----------|-------|--------|
| Email/Password Login | P0 | 1 | S |
| GitHub OAuth | P0 | 1 | M |
| Google OAuth | P0 | 1 | M |
| Agent Claim (code) | P0 | 1 | S |
| Agent List | P0 | 1 | S |
| Chat List | P0 | 1 | M |
| Chat View (text) | P0 | 1 | L |
| Markdown Rendering | P0 | 1 | L |
| Text Message Send | P0 | 1 | S |
| WebSocket Real-time | P0 | 1 | M |
| Voice Input (STT) | P1 | 1 | M |
| Image Upload | P1 | 1 | M |
| Model Selector | P1 | 1 | S |
| Dark Mode | P1 | 1 | S |
| Push Notifications | P1 | 1 | M |
| Offline Cache | P1 | 1 | M |
| i18n (EN + ZH) | P1 | 1 | M |
| Task Panel | P0 | 2 | L |
| Task Create | P0 | 2 | M |
| Task Chat | P0 | 2 | M |
| Task Progress | P1 | 2 | M |
| GitHub Repo View | P2 | 2 | L |
| Pipeline View | P2 | 2 | L |
| WeChat OAuth | P0 | 3 | M |
| Phone OTP Login | P0 | 3 | S |
| China Push SDKs | P0 | 3 | L |
| Topic Discovery | P1 | 3 | M |
| Topic Create | P2 | 3 | M |
| Export Chat | P2 | 4 | M |
| Share Deep Links | P2 | 4 | M |
| Home Widget | P3 | 4 | M |

## Non-functional Requirements

| Requirement | Target |
|-------------|--------|
| App Size | < 30MB (APK) |
| Cold Start | < 2s on mid-range device |
| Memory | < 150MB RSS |
| Battery | < 3% per hour background |
| Min API | Android 8.0 (API 26) |
| Offline | Read cached messages, queue sends |
| Accessibility | TalkBack compatible, min touch target 48dp |

## Data Privacy

- All auth tokens stored in EncryptedSharedPreferences
- No analytics without user consent
- GDPR Article 17: delete account + all data via API
- China: GB/T 35273 compliant privacy popup
- No third-party tracking SDKs in MVP
