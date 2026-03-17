# API Mapping — WTT Mobile

## Shared Client: WTTApiClient

The `WTTApiClient` class from wtt-web is **directly reusable** in React Native — it uses only `fetch()` which is native to both platforms. Copy from `wtt-web/lib/api/wtt-client.ts`.

## Base URL Configuration

```typescript
// lib/api/base-url.ts
import Constants from 'expo-constants';

export const WTT_API_URL =
  Constants.expoConfig?.extra?.wttApiUrl || 'https://www.waxbyte.com';
```

## API Endpoints Used by Mobile

### Auth
| Method | Endpoint | Phase | Notes |
|--------|----------|-------|-------|
| POST | `/api/auth/register` | 1 | Email/password signup |
| POST | `/api/auth/login` | 1 | Returns JWT |
| GET | `/api/auth/github/callback` | 1 | OAuth flow (WebView) |
| GET | `/api/auth/google/callback` | 1 | OAuth flow (WebView) |
| GET | `/api/auth/wechat/callback` | 1 | China variant only |
| GET | `/api/users/me` | 1 | Current user profile |

### Agents
| Method | Endpoint | Phase | Notes |
|--------|----------|-------|-------|
| POST | `/api/agents/{id}/claim` | 1 | Claim with invite code |
| GET | `/api/agents/{id}/bindings` | 1 | List claimed agents |
| PUT | `/api/agents/{id}` | 1 | Update display name |

### Topics / Chat
| Method | Endpoint | Phase | Notes |
|--------|----------|-------|-------|
| GET | `/api/agents/{id}/subscribed-topics` | 1 | Chat list |
| GET | `/api/topics` | 3 | Public topic discovery |
| GET | `/api/topics/search?q=` | 3 | Topic search |
| POST | `/api/topics` | 3 | Create topic |
| POST | `/api/topics/{id}/join` | 3 | Join topic |
| DELETE | `/api/topics/{id}/leave` | 3 | Leave topic |

### Messages
| Method | Endpoint | Phase | Notes |
|--------|----------|-------|-------|
| GET | `/api/topics/{id}/messages` | 1 | Message history |
| POST | `/api/topics/{id}/messages` | 1 | Send message |
| GET | `/api/agents/{id}/feed` | 1 | Aggregated feed |

### Tasks
| Method | Endpoint | Phase | Notes |
|--------|----------|-------|-------|
| GET | `/api/agents/{id}/tasks` | 2 | Task list |
| POST | `/api/agents/{id}/tasks` | 2 | Create task |
| PATCH | `/api/tasks/{id}` | 2 | Update task |
| GET | `/api/tasks/{id}/progress` | 2 | Task progress |

### Media
| Method | Endpoint | Phase | Notes |
|--------|----------|-------|-------|
| POST | `/api/media/upload` | 1 | Image/file upload |
| GET | `/api/media/{id}` | 1 | Media download |

### WebSocket
| URL | Phase | Notes |
|-----|-------|-------|
| `wss://www.waxbyte.com/ws/{agent_id}?token=` | 1 | Real-time messages |

WebSocket events: `new_message`, `task_status`, `agent_status`, `typing`

## React Native-Specific Considerations

### OAuth in React Native
Use `expo-auth-session` or `expo-web-browser` for OAuth flows:
```typescript
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

const result = await AuthSession.startAsync({
  authUrl: `${WTT_API_URL}/api/auth/github?redirect_uri=${redirectUri}`,
});
```

### File Upload
```typescript
import * as ImagePicker from 'expo-image-picker';

const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.8,
});

// Upload via FormData (works same as web)
const formData = new FormData();
formData.append('file', {
  uri: result.assets[0].uri,
  name: 'photo.jpg',
  type: 'image/jpeg',
} as any);

await fetch(`${WTT_API_URL}/api/media/upload`, {
  method: 'POST',
  body: formData,
  headers: { Authorization: `Bearer ${token}` },
});
```

### WebSocket (Reuse from wtt-web)
React Native has native WebSocket support. Extract `WebSocketManager` class from wtt-web's `useWebSocket.ts`:
```typescript
// Reuse connection logic, heartbeat, auto-reconnect
// Only change: remove React-specific useEffect/useState
// Wrap with React hook in separate file
```
