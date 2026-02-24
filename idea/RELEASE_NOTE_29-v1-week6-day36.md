# Release Note

**Release date:** 24/02/2026  
**Scope:** Gateway Service — WebSocket Module  
**Device:** Backend API (NestJS) — gateway  
**Branch:** `29-v1-week6-day36`

---

## Overview

Hoàn thành yêu cầu **Day 36** (DAILY_SCHEDULE_CORE_V1): Thiết lập WebSocket server trong Gateway với JWT authentication và Socket Registry để hỗ trợ real-time notifications.

- **Day 36:** WebSocket Gateway với Socket.IO, JWT authentication khi handshake, Socket Registry quản lý mapping userId → socketIds (hỗ trợ multi-tab).

---

## Changes

### Gateway Service

**WebSocket Module (Day 36)**

- **`websocket.module.ts`**: Module wrapper gom các components WebSocket, export `NotificationWebsocketGateway` và `SocketRegistryService` để các module khác có thể inject.

- **`websocket.gateway.ts`**: WebSocket Gateway chính với các chức năng:
  - `@WebSocketGateway()` decorator với CORS config
  - `handleConnection()`: Xác thực JWT khi client kết nối (hỗ trợ token từ query string, Authorization header, hoặc socket.io auth object)
  - `handleDisconnect()`: Cleanup socket khỏi registry khi client ngắt kết nối
  - `extractToken()`: Hỗ trợ 3 cách gửi token từ client
  - `verifyToken()`: Verify JWT với cùng secret/issuer/audience như HTTP API
  - `emitToUser()`: Gửi event đến tất cả sockets của một user (hỗ trợ multi-tab)
  - `broadcast()`: Gửi event đến tất cả connected clients
  - `@SubscribeMessage('ping')`: Handler cho ping/pong heartbeat

- **`socket-registry.service.ts`**: Service quản lý mapping connections:
  - `userSockets`: Map<userId, Set<socketId>> — biết user có những socket nào
  - `socketToUser`: Map<socketId, userId> — biết socket thuộc user nào (lookup ngược)
  - `register(userId, socketId)`: Đăng ký socket khi auth thành công
  - `unregister(socketId)`: Hủy đăng ký khi disconnect
  - `getSocketsByUser(userId)`: Lấy tất cả sockets của user
  - `getUserBySocket(socketId)`: Lấy userId từ socketId
  - `isUserOnline(userId)`: Kiểm tra user có đang online
  - `getOnlineUsersCount()`: Đếm số users đang online
  - `getTotalConnectionsCount()`: Đếm tổng số connections

**Integration**

- **`app.module.ts`**: Import `WebsocketModule` vào AppModule

**Testing**

- **`test-websocket.html`**: File HTML test WebSocket trong browser với các chức năng:
  - Input nhập JWT token
  - Buttons: Connect, Disconnect, Send Ping
  - Log panel hiển thị events realtime
  - Hỗ trợ test các events: `authenticated`, `error`, `pong`, `notification:new`, `notification:updated`

### Documentation

- **`WEEK6_DAY36-42_PLAN.md`**: Tài liệu kế hoạch chi tiết cho Tuần 6 bao gồm:
  - Mục tiêu và chức năng WebSocket Notification
  - Kiến trúc hệ thống với sơ đồ
  - Chi tiết các service tham gia
  - Luồng dữ liệu (Data Flow)
  - TODO chi tiết cho từng ngày (Day 36-42)

---

## API Reference

### WebSocket Events

**Server → Client:**

| Event | Payload | Mô tả |
|-------|---------|-------|
| `authenticated` | `{ userId, message }` | Xác thực thành công |
| `error` | `{ message }` | Lỗi (auth failed, etc.) |
| `pong` | `{ timestamp }` | Response cho ping |
| `notification:new` | _(Day 37)_ | Notification mới (chưa implement) |
| `notification:updated` | _(Day 38)_ | Notification đã cập nhật (chưa implement) |

**Client → Server:**

| Event | Payload | Mô tả |
|-------|---------|-------|
| `ping` | _(none)_ | Heartbeat check |
| `notification:read` | _(Day 38)_ | Mark notification as read (chưa implement) |
| `notification:read-all` | _(Day 38)_ | Mark all as read (chưa implement) |

### Connection Authentication

Client có thể gửi JWT token bằng 3 cách:

```javascript
// Cách 1: Query string
io('http://localhost:3000?token=eyJ...')

// Cách 2: Auth object (khuyên dùng)
io('http://localhost:3000', { auth: { token: 'eyJ...' } })

// Cách 3: Authorization header
io('http://localhost:3000', { 
  extraHeaders: { Authorization: 'Bearer eyJ...' } 
})
```

---

## Migration

**Migration required:** No (không đổi schema database).

---

## Dependencies

**Added:**

| Package | Version | Scope |
|---------|---------|-------|
| `@nestjs/websockets` | ^11.0.1 | gateway |
| `@nestjs/platform-socket.io` | ^11.0.1 | gateway |
| `socket.io` | ^4.8.1 | gateway |

**Frontend (để test):**

```bash
npm install socket.io-client
```

---

## Affected Files

```
apps/gateway/
  package.json                                    # Thêm dependencies
  src/app.module.ts                               # Import WebsocketModule
  src/modules/websocket/
    index.ts                                      # Export module
    websocket.module.ts                           # Module definition
    websocket.gateway.ts                          # WebSocket Gateway
    socket-registry.service.ts                    # Connection registry
  test-websocket.html                             # Test client

idea/
  WEEK6_DAY36-42_PLAN.md                          # Kế hoạch Tuần 6
  RELEASE_NOTE_29-v1-week6-day36.md               # File này
```

---

## Testing

### Manual Test với Browser

1. Chạy gateway: `npm run dev:gateway`
2. Login lấy JWT token: `POST /client/auth/login`
3. Mở file `apps/gateway/test-websocket.html` trong browser
4. Paste token và click "Connect"
5. Verify:
   - Status hiển thị "Connected ✓"
   - Log hiển thị "Authenticated! User ID: xxx"
   - Click "Send Ping" → nhận "Pong received!"

### Expected Logs (Gateway)

```
{"level":"info","msg":"WebSocket Gateway initialized"}
{"level":"info","userId":"xxx","socketId":"xxx","totalSockets":1,"msg":"Socket registered"}
{"level":"info","socketId":"xxx","userId":"xxx","onlineUsers":1,"totalConnections":1,"msg":"WS client connected and authenticated"}
```

---

## Next Steps (Day 37-42)

- **Day 37:** Subscribe `notification.created` từ NATS → push WS event
- **Day 38:** WS inbound handlers: `notification:read`, `notification:read-all`
- **Day 39:** Multi-tab sync, unread count realtime
- **Day 40:** Rate limiting, disconnect cleanup hardening
- **Day 41-42:** Load testing với 50+ concurrent connections

---

_Branch `29-v1-week6-day36` — WebSocket Foundation for Real-time Notifications_
