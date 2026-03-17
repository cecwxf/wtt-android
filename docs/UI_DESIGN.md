# UI Design Specification — WTT Mobile

## Design Principles

1. **Content First** — Messages are the hero; chrome is minimal
2. **Familiar Patterns** — ChatGPT/Claude app conventions
3. **One-hand Friendly** — Bottom tabs, thumb-reachable actions
4. **Cross-platform** — Same design on Android + (future) iOS
5. **Adaptive** — Light ↔ Dark, phone ↔ tablet, EN ↔ ZH

## Technology: Tamagui

Using **Tamagui** as the UI framework for React Native:
- Design tokens (colors, spacing, typography) defined once
- Compile-time optimization (faster than runtime styling)
- Built-in dark mode support via theme tokens
- Responsive layouts via media queries

## Color System

### Light Theme
| Token | Value | Usage |
|-------|-------|-------|
| primary | `#6366F1` | Active states, links, FAB |
| onPrimary | `#FFFFFF` | Text on primary |
| surface | `#FFFFFF` | Cards, sheets |
| background | `#F8FAFC` | Page background |
| text | `#1E293B` | Body text |
| textSecondary | `#64748B` | Secondary text |
| border | `#E2E8F0` | Dividers |
| userBubble | `#EEF2FF` | User message bg |
| agentBubble | `#FFFFFF` | Agent message bg |
| error | `#EF4444` | Errors |
| success | `#22C55E` | Success |

### Dark Theme
| Token | Value | Usage |
|-------|-------|-------|
| primary | `#818CF8` | Active states |
| surface | `#18181B` | Cards |
| background | `#09090B` | Page bg |
| text | `#E4E4E7` | Body text |
| userBubble | `#312E81` | User bubble bg |
| agentBubble | `#27272A` | Agent bubble bg |

## Typography

| Style | Size | Weight | Font |
|-------|------|--------|------|
| Display | 28 | Bold | Inter |
| Title | 20 | SemiBold | Inter |
| Body | 15 | Regular | Inter |
| Code | 13 | Regular | JetBrains Mono |
| Caption | 12 | Regular | Inter |
| Label | 11 | Medium | Inter |

Chinese fallback: Noto Sans SC (bundled subset)

## Spacing

4px base: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

## Components

### Chat Bubble
```
┌────────────────────────────────┐
│ Agent Name (12sp, primary)     │  ← Only for agent messages
│                                │
│ Message content with           │
│ **markdown** and `code`        │
│                                │
│            10:42 AM (11sp) ──→ │
└────────────────────────────────┘
  Border radius: 16px (8px on sender corner)
  Padding: 12px H, 10px V
  Max width: 82% screen width
  User: right, userBubble bg
  Agent: left, agentBubble bg + left border accent
```

### Input Bar
```
┌──────────────────────────────────────┐
│ [🎤] [📎] │ Type message...  │ [➤]  │
└──────────────────────────────────────┘
  Height: 56px (expandable to 120px multiline)
  🎤 Hold-to-record, release to STT
  📎 Bottom sheet: camera, gallery, file
  ➤ Active when text non-empty (primary color)
  Model chip: above bar, collapsible
```

### Bottom Tabs (Expo Router)
```
┌────────┬────────┬────────┬────────┐
│  💬    │  📋    │  🔍    │  👤    │
│ Chats  │ Tasks  │ Explore│  Me    │
└────────┴────────┴────────┴────────┘
  Height: 64px + safe area inset
  Active: filled icon + label + primary color
  Inactive: outline icon only
  Badge on Chats for unread count
```

### Task Card
```
┌─────────────────────────────────┐
│ 🔴 P0  │ Fix login bug    │ ⋮  │
│─────────────────────────────────│
│ ▓▓▓▓▓▓▓░░░ 72%                 │
│ My Agent  •  2h ago             │
└─────────────────────────────────┘
  Border radius: 12px
  Left accent: 4px color bar (priority)
  Shadow: subtle elevation
```

## Animations

| Transition | Type | Duration |
|-----------|------|----------|
| Screen push | Slide from right | 300ms |
| Bottom sheet | Spring slide up | 250ms |
| Message appear | Fade + slide up 8px | 200ms |
| Send button | Scale 0.9→1.0 spring | 150ms |
| Pull to refresh | Native | System |
| Skeleton | Shimmer (MotiView) | Continuous |

React Native Reanimated 3 for all animations (worklet-based, 60fps).

## Responsive

| Width | Layout |
|-------|--------|
| < 600 | Phone — single column, bottom tabs |
| 600-840 | Tablet — split view in landscape |
| > 840 | Tablet — persistent sidebar + chat |

## Accessibility

- All interactive elements have `accessibilityLabel`
- Dynamic type (respect system font size)
- Minimum touch target: 44x44px
- Color contrast: WCAG AA (4.5:1 text, 3:1 UI)
- Screen reader: TalkBack (Android), VoiceOver (iOS)
