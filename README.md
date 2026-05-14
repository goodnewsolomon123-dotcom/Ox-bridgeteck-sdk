# OX-Bridge JavaScript SDK

A Firebase-like real-time messaging SDK powered by the OX-Bridge API Platform.

## Quick Start

Add this one line to your HTML:

```html
<script src="https://cdn.jsdelivr.net/gh/goodnewsolomon123-dotcom/oxbridge-sdk@main/oxbridge.js"></script>
```

## Usage

```javascript
// 1. Initialize with your API key
const ox = new OXBridge("your-api-key")

// 2. Register a user
await ox.register("john", "john@email.com", "password123")

// 3. Or login
await ox.login("john", "password123")

// 4. Send a message
await ox.sendMessage("jane", "Hello Jane!")

// 5. Listen for messages in real time
ox.onMessage((msg) => {
  console.log(msg.from, msg.content)
})

// 6. Send an image/video/voice
const file = document.getElementById('file-input').files[0]
await ox.sendMedia("jane", file, "Check this out!")

// 7. Create a group
const group = await ox.createGroup("Study Squad", "WAEC prep group")

// 8. Video call
await ox.callUser("jane", "video")
ox.onIncomingCall((call) => {
  console.log("Incoming call from", call.from)
})
```

## Get Your API Key

1. Visit: https://ox-bridge-backend.onrender.com/docs
2. Register your developer app
3. Copy your API key

## API Reference

| Method | Description |
|--------|-------------|
| `ox.register(username, email, password)` | Register a new user |
| `ox.login(username, password)` | Login a user |
| `ox.logout()` | Logout current user |
| `ox.getMe()` | Get current user profile |
| `ox.uploadAvatar(file)` | Upload profile picture |
| `ox.getUsers()` | Get all users in your app |
| `ox.getOnlineUsers()` | Get online users |
| `ox.sendMessage(to, content)` | Send text message |
| `ox.sendMedia(to, file, caption)` | Send image/video/voice |
| `ox.getMessages(username)` | Get conversation |
| `ox.getUnreadCount()` | Get unread count |
| `ox.deleteMessage(id)` | Delete a message |
| `ox.createGroup(name, description)` | Create a group |
| `ox.getGroups()` | Get my groups |
| `ox.addGroupMember(groupId, username)` | Add member to group |
| `ox.sendGroupMessage(groupId, content)` | Send group message |
| `ox.sendGroupMedia(groupId, file, caption)` | Send media to group |
| `ox.getGroupMessages(groupId)` | Get group messages |
| `ox.callUser(username, type)` | Start voice/video call |
| `ox.sendSignal(to, type, payload)` | Send WebRTC signal |
| `ox.endCall(username)` | End a call |

## Real-time Events

| Event | Description |
|-------|-------------|
| `ox.onMessage(cb)` | New direct message |
| `ox.onGroupMessage(cb)` | New group message |
| `ox.onPresence(cb)` | User online/offline |
| `ox.onIncomingCall(cb)` | Incoming call |
| `ox.onUnreadCount(cb)` | Unread count update |
| `ox.onConnected(cb)` | WebSocket connected |
| `ox.onDisconnected(cb)` | WebSocket disconnected |

## Built With
- OX-Bridge API Platform
- FastAPI + WebSockets
- Cloudinary (media)
- PostgreSQL (Neon)
