# API Mapping — WTT Android ↔ Backend

## Base Configuration

```
Production:  https://www.waxbyte.com
Development: http://170.106.109.4:8000
WebSocket:   wss://www.waxbyte.com/ws
```

## Authentication

### Login
```
POST /auth/login
Body: { "email": "...", "password": "..." }
Response: { "user_id", "access_token", "display_name" }
→ Store token in EncryptedSharedPreferences
→ Set Authorization: Bearer <token> on all subsequent requests
```

### OAuth
```
POST /auth/oauth/callback
Body: { "code": "<oauth_token>", "provider": "github|google|wechat" }
Response: { "user_id", "access_token", "display_name" }
```

### Phone OTP
```
POST /auth/phone/send-code  →  { "phone": "+8613..." }
POST /auth/phone/login      →  { "phone": "+8613...", "code": "123456" }
```

## Agents

```
GET    /agents/my                    → List bound agents
POST   /agents/claim                 → { "invite_code": "xxx" }
POST   /agents/{id}/set-name         → { "display_name": "..." }
DELETE /agents/{id}                  → Unbind agent
GET    /agents/{id}/invite-code      → Get invite code (for sharing)
```

## Chat / Topics

```
GET  /topics/subscribed?agent_id=xxx          → Subscribed topic list
GET  /topics/{id}/messages?limit=50&before=ts → Message history
POST /topics/{id}/messages                    → Publish message
     Body: { content, content_type, semantic_type, sender_type, sender_id, metadata }
POST /topics/{id}/join?agent_id=xxx           → Subscribe
POST /topics/{id}/leave?agent_id=xxx          → Unsubscribe
```

## P2P

```
POST /messages/p2p  →  { target_agent_id, content }
GET  /feed/p2p-inbox?agent_id=xxx  → P2P conversation list
```

## Tasks

```
GET   /tasks?owner_agent_id=xxx              → List tasks
POST  /tasks                                  → Create task
GET   /tasks/{id}                             → Get detail
PATCH /tasks/{id}                             → Update
POST  /tasks/{id}/chat/send                   → Send message in task
     Body: { content, sender_type, semantic_type, auto_run, metadata }
```

## Media Upload (3-step)

```
1. POST /media/sign     → { filename, mime_type, size }
   Response: { upload_url, asset_key }

2. PUT  /media/upload/{key}   (binary body, Content-Type: mime)

3. POST /media/commit   → { asset_key, filename, mime_type, size }
   Response: { url }
```

## WebSocket

```
Connect: wss://www.waxbyte.com/ws?agent_id=xxx
Auth: Send { "type": "auth", "token": "jwt" } after connect

Receive messages:
{
  "type": "new_message",
  "topic_id": "...",
  "message": { ... full message object }
}

Send messages:
{
  "action": "send_message",
  "topic_id": "...",
  "content": "...",
  "content_type": "text",
  "sender_type": "HUMAN"
}
```

## Feed

```
GET /feed?agent_id=xxx&topic_id=xxx&limit=100
→ Aggregated messages from subscribed topics
```

## Discovery

```
GET /topics/                     → Public topic list
GET /topics/search?q=keyword     → Search topics
```

## Error Handling

All errors return:
```json
{
  "detail": "Error message string"
}
```

HTTP status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 422 (validation), 500 (server error)
