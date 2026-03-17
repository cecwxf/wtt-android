# UI Design Specification — WTT Android

## Design Principles

1. **Content First** — Messages are the hero; chrome is minimal
2. **Familiar Patterns** — ChatGPT/Claude app conventions (users already know how)
3. **One-hand Friendly** — Bottom navigation, thumb-reachable actions
4. **Adaptive** — Light ↔ Dark, phone ↔ tablet, EN ↔ ZH

## Color System

### Light Theme
| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#6366F1` (Indigo 500) | Active states, links, FAB |
| On Primary | `#FFFFFF` | Text on primary |
| Surface | `#FFFFFF` | Cards, sheets |
| Background | `#F8FAFC` (Slate 50) | Page background |
| On Surface | `#1E293B` (Slate 800) | Body text |
| On Surface Variant | `#64748B` (Slate 500) | Secondary text |
| Outline | `#E2E8F0` (Slate 200) | Dividers, borders |
| User Bubble | `#EEF2FF` (Indigo 50) | User message bg |
| Agent Bubble | `#FFFFFF` | Agent message bg |
| Error | `#EF4444` (Red 500) | Errors |
| Success | `#22C55E` (Green 500) | Success indicators |

### Dark Theme
| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#818CF8` (Indigo 400) | Active states |
| Surface | `#18181B` (Zinc 900) | Cards |
| Background | `#09090B` (Zinc 950) | Page background |
| On Surface | `#E4E4E7` (Zinc 200) | Body text |
| User Bubble | `#312E81` (Indigo 900/20%) | User message bg |
| Agent Bubble | `#27272A` (Zinc 800) | Agent message bg |

## Typography

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | 28sp | Bold | Screen titles |
| Title | 20sp | SemiBold | Section headers |
| Body | 15sp | Regular | Message text |
| Code | 13sp | Mono | Code blocks |
| Caption | 12sp | Regular | Timestamps, metadata |
| Label | 11sp | Medium | Chips, badges |

## Spacing System

`4dp` base unit: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

## Component Specifications

### Chat Bubble
```
┌────────────────────────────────┐
│ Sender Name (12sp, indigo)     │  ← Only for agent messages
│                                │
│ Message content (15sp)         │
│ supports **markdown**, `code`, │
│ and multi-line text            │
│                                │
│            10:42 AM (11sp) ──→ │  ← Right-aligned timestamp
└────────────────────────────────┘
  Corner radius: 16dp (8dp on sender corner)
  Padding: 12dp horizontal, 10dp vertical
  Max width: 82% of screen
  User: right-aligned, indigo bg
  Agent: left-aligned, surface bg
```

### Input Bar
```
┌──────────────────────────────────────┐
│ [🎤] [📎] │ Type message...  │ [➤]  │
└──────────────────────────────────────┘
  Height: 56dp (expandable to 120dp)
  Mic: hold-to-record, release-to-send
  Clip: bottom sheet (camera, gallery, file)
  Send: enabled only when text non-empty
  Model chip: above input bar, collapsible
```

### Bottom Navigation
```
┌────────┬────────┬────────┬────────┐
│  💬    │  📋    │  🔍    │  👤    │
│ Chats  │ Tasks  │ Explore│  Me    │
└────────┴────────┴────────┴────────┘
  Height: 64dp + safe area
  Active: filled icon + label
  Inactive: outlined icon, no label
```

### Task Card
```
┌─────────────────────────────────┐
│ 🔴 P0  │ Fix login bug    │ ⋮  │
│─────────────────────────────────│
│ ▓▓▓▓▓▓▓░░░ 72%                 │
│ Agent: My Agent  •  2h ago      │
└─────────────────────────────────┘
  Corner radius: 12dp
  Left accent: 4dp color bar (priority)
  Elevation: 1dp
```

## Animations

| Transition | Type | Duration |
|-----------|------|----------|
| Screen push | Shared axis X | 300ms |
| Bottom sheet | Slide up | 250ms |
| Message appear | Fade + slide up | 200ms |
| Send button | Scale bounce | 150ms |
| Pull to refresh | Material refresh | System |
| Skeleton loading | Shimmer | Continuous |

## Responsive Breakpoints

| Width | Layout |
|-------|--------|
| < 600dp | Phone — single column, bottom nav |
| 600-840dp | Small tablet — master-detail in landscape |
| > 840dp | Large tablet — persistent side panel + chat |
