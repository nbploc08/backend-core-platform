# Tuần 6 — Realtime WebSocket + Contract-first WS Payloads

**Phạm vi:** Day 36–42 theo `DAILY_SCHEDULE_CORE_V1.md`
**Mục tiêu:** WebSocket realtime cho notification bell, đồng bộ nhiều tabs, idempotency demo

---

## 🎯 Mục tiêu chính

**Xây dựng hệ thống thông báo realtime** — cho phép user nhận notification ngay lập tức mà không cần refresh trang, đồng bộ giữa nhiều tabs/devices.

---

## 🔔 Chức năng của tính năng WebSocket Notification

### 1. Push notification realtime
- Khi có notification mới (ví dụ: welcome noti sau đăng ký), user nhận ngay lập tức
- Bell icon cập nhật số unread mà không cần gọi API

### 2. Đồng bộ nhiều tabs (Multi-tab sync)
- User mở 2+ tabs cùng tài khoản
- Đánh dấu đã đọc ở tab A → tab B tự động cập nhật
- Bell count đồng bộ realtime giữa các tabs

### 3. Two-way communication
- **Server → Client:** Push notification mới, cập nhật unread count
- **Client → Server:** Mark read, read-all qua WebSocket (không cần REST API)

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                                      │
│  │  Tab 1  │  │  Tab 2  │  │  Tab 3  │  ← Nhiều tabs cùng user              │
│  └────┬────┘  └────┬────┘  └────┬────┘                                      │
│       │            │            │                                            │
│       └────────────┼────────────┘                                            │
│                    │ WebSocket connections                                   │
└────────────────────┼────────────────────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         GATEWAY SERVICE (port 3000)                         │
│                                                                             │
│  ┌─────────────────────────┐    ┌─────────────────────────────────────┐    │
│  │   WebSocket Gateway     │    │      Socket Registry                │    │
│  │   (/ws endpoint)        │◄──►│  Map<userId, Set<socketId>>         │    │
│  │                         │    │                                     │    │
│  │  • Auth với JWT         │    │  • Track connections per user       │    │
│  │  • Handle events        │    │  • Lookup sockets để broadcast      │    │
│  └───────────┬─────────────┘    └─────────────────────────────────────┘    │
│              │                                                              │
│              │                  ┌─────────────────────────────────────┐    │
│              │                  │   JetStream WS Consumer             │    │
│              │                  │                                     │    │
│              │                  │  • Subscribe notification.created   │    │
│              │                  │  • Trigger push to sockets          │    │
│              │                  └─────────────────────────────────────┘    │
│              │                              │                               │
│              │                              │ Subscribe                     │
└──────────────┼──────────────────────────────┼──────────────────────────────┘
               │ Internal API                 │
               │ (HTTP + Internal JWT)        │
               ▼                              ▼
┌──────────────────────────────┐    ┌────────────────────────────────────────┐
│  NOTIFICATION SERVICE        │    │              NATS JetStream             │
│  (port 3002)                 │    │                                         │
│                              │    │  Stream: NOTIFICATION_EVENT             │
│  • list, unreadCount         │◄───│  Subject: notification.created          │
│  • markRead, readAll         │    │                                         │
│  • Publish notification.created   │                                         │
└──────────────────────────────┘    └────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│       PostgreSQL             │
│   (schema: notification)     │
│                              │
│   Table: notifications       │
└──────────────────────────────┘
```

---

## 📍 Chạy ở đâu?

| Component | Service | Port | Vai trò |
|-----------|---------|------|---------|
| **WebSocket Server** | Gateway | 3000 | Quản lý kết nối WS, auth, broadcast |
| **Socket Registry** | Gateway | 3000 | Track user → sockets mapping |
| **JetStream Consumer** | Gateway | 3000 | Subscribe events từ NATS |
| **Notification APIs** | Notification-service | 3002 | CRUD notifications, publish events |
| **Event Bus** | NATS JetStream | 4222 | Trung gian events giữa services |
| **Database** | PostgreSQL | 5432 | Lưu notifications |

---

## 🔧 Các Service tham gia

### 1. Gateway Service (chủ đạo cho WebSocket)

**Files mới cần tạo:**
```
apps/gateway/src/modules/websocket/
├── websocket.module.ts          # NestJS module
├── websocket.gateway.ts         # WebSocket Gateway (handle connections)
├── socket-registry.service.ts   # Track userId → sockets
└── jetstream-ws-consumer.service.ts  # Subscribe NATS events
```

**Chức năng:**
- Chấp nhận WebSocket connections từ clients
- Verify JWT và authenticate user
- Track socket connections per user (1 user có thể có nhiều tabs)
- Nhận events từ NATS → push đến đúng user
- Handle inbound messages (read, read-all) → gọi notification-service

---

### 2. Notification Service (hỗ trợ)

**Files cần sửa:**
```
apps/notification-service/src/modules/notification/notification.service.ts
apps/notification-service/src/modules/nats/nats.service.ts
```

**Chức năng:**
- Khi tạo notification mới → publish `notification.created` event lên NATS
- Cung cấp internal APIs: `unreadCount`, `markRead`, `readAll`

---

### 3. Packages/Contracts (định nghĩa schemas)

**Files mới cần tạo:**
```
packages/contracts/src/ws/
├── index.ts
├── notification-new.ws.ts       # Schema cho event notification:new
├── notification-read.ws.ts      # Schema cho event notification:read
├── notification-read-all.ws.ts  # Schema cho event notification:read-all
├── notification-updated.ws.ts   # Schema cho broadcast event
└── unread-count-updated.ws.ts   # Schema cho unread count update
```

---

## 📨 Luồng dữ liệu (Data Flow)

### Flow 1: User đăng ký → nhận welcome notification

```
1. User register → auth-service tạo user
                 → publish USER_REGISTERED event

2. Notification-service subscribe USER_REGISTERED
   → Tạo welcome notification trong DB
   → Publish NOTIFICATION_CREATED event

3. Gateway subscribe NOTIFICATION_CREATED
   → Lookup sockets của userId từ Socket Registry
   → Emit "notification:new" đến tất cả sockets của user

4. Client (browser) nhận event
   → Hiển thị notification
   → Cập nhật bell count
```

### Flow 2: User đánh dấu đã đọc qua WebSocket

```
1. User click "mark as read" trên Tab A
   → Client gửi WS event "notification:read" { notificationId }

2. Gateway nhận message
   → Validate payload với Zod
   → Gọi notification-service POST /notification/:id/read (internal JWT)

3. Notification-service update DB (readAt = now)
   → Return success

4. Gateway broadcast "notification:updated" đến TẤT CẢ sockets của user
   → Tab A, Tab B, Tab C đều nhận event
   → Tất cả tabs cập nhật UI đồng bộ
```

---

## 🔐 Security

| Layer | Mechanism |
|-------|-----------|
| WS Connection | JWT verify khi handshake |
| Socket Registry | Chỉ emit đến sockets đã authenticated |
| Internal APIs | Internal JWT giữa Gateway → Notification-service |
| Rate Limiting | Max messages per second per user |

---

## 📊 Tóm tắt nhanh

| Câu hỏi | Trả lời |
|---------|---------|
| **Mục tiêu?** | Notification realtime, multi-tab sync |
| **Chạy ở đâu?** | Gateway service (port 3000) |
| **Services tham gia?** | Gateway (chính), Notification-service (hỗ trợ), NATS (event bus) |
| **Protocol?** | WebSocket (Socket.IO) |
| **Authentication?** | JWT trong handshake hoặc AUTH message |

---

## Tổng quan tiến độ Week 6

| Ngày       | Nội dung                                              | Trạng thái  | Ghi chú |
| ---------- | ----------------------------------------------------- | ----------- | ------- |
| **Day 36** | WS auth + socket registry                             | ❌ Chưa làm |         |
| **Day 37** | Subscribe notification.created → push WS              | ❌ Chưa làm |         |
| **Day 38** | WS inbound: notification:read / read-all              | ❌ Chưa làm |         |
| **Day 39** | Unread count realtime + bell sync                     | ❌ Chưa làm |         |
| **Day 40** | WS hardening (rate limit, disconnect cleanup)         | ❌ Chưa làm |         |
| **Day 41-42** | Buffer + load test                                 | ❌ Chưa làm |         |

---

## Các task còn nợ từ Tuần 5 (cần hoàn thành trước)

| Task | Ưu tiên | Trạng thái |
|------|---------|------------|
| **Day 31:** Thêm `@RequirePermission` cho gateway notification endpoints | Cao | ⚠️ Thiếu |
| **Day 32:** Tạo welcome notification trong DB + publish `notification.created` | **Rất cao** | ⚠️ Thiếu (blocker Day 37) |
| **Day 34:** Apply idempotency cho `POST /notifications/:id/read` | Trung bình | ⚠️ Thiếu |

---

## Day 36 — WS auth + socket registry

**Mục tiêu:**
1. WS server trong gateway (NestJS WebSocket Gateway với `@nestjs/websockets` + `socket.io`)
2. Client gửi JWT trong handshake hoặc message `AUTH {token}`
3. Verify JWT, map userId → sockets (Socket Registry)

**TODO chi tiết:**

- [ ] Cài đặt dependencies:
  ```bash
  npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
  ```

- [ ] Tạo `apps/gateway/src/modules/websocket/websocket.module.ts`
- [ ] Tạo `apps/gateway/src/modules/websocket/websocket.gateway.ts`:
  - Decorator `@WebSocketGateway()` với CORS config
  - Handle `connection`, `disconnect` events
  - Handle `AUTH` message để authenticate
- [ ] Tạo `apps/gateway/src/modules/websocket/socket-registry.service.ts`:
  - `Map<userId, Set<socketId>>`
  - Methods: `register(userId, socketId)`, `unregister(socketId)`, `getSocketsByUser(userId)`
- [ ] Implement JWT verification khi WS connect (extract from query/header)
- [ ] Cleanup socket khi disconnect

**Deliverables:**
- WS endpoint hoạt động tại `ws://localhost:3000` (hoặc namespace `/ws`)
- Client có thể connect với JWT và được authenticate
- Socket registry track được user connections

---

## Day 37 — Subscribe `notification.created` → push WS `notification:new`

**Mục tiêu:**
1. Gateway subscribe JetStream event `notification.created`
2. Emit đến tất cả sockets của user
3. Include unreadCount update

**Phụ thuộc:** Day 32 (notification-service phải publish `notification.created`)

**TODO chi tiết:**

- [ ] Tạo `apps/gateway/src/modules/websocket/jetstream-ws-consumer.service.ts`:
  - Subscribe stream `NOTIFICATION_EVENT`, subject `notification.created`
  - Parse payload với `NotificationCreatedSchema`
  - Lookup sockets by `userId` từ Socket Registry
  - Emit `notification:new` event với payload

- [ ] Khi emit `notification:new`, đính kèm thêm `unreadCount`:
  - Gọi notification-service internal API `/notification/unread-count?userId=...`
  - Hoặc cache unreadCount

- [ ] Define event payload trong `packages/contracts/src/ws/notification-new.ws.ts`:
  ```typescript
  export const WS_NOTIFICATION_NEW = 'notification:new';
  export const NotificationNewPayloadSchema = z.object({
    notificationId: z.string().uuid(),
    userId: z.string().uuid(),
    type: z.string(),
    title: z.string(),
    body: z.string().optional(),
    createdAt: z.string().datetime(),
    unreadCount: z.number().int().min(0),
  });
  ```

**Deliverables:**
- Khi có notification mới, user nhận được WS event `notification:new` realtime
- Payload bao gồm notification details + unreadCount

---

## Day 38 — WS inbound: `notification:read` / `read-all`

**Mục tiêu:**
1. Define WS payload contract trong `packages/contracts`
2. Validate inbound messages với Zod
3. Gateway gọi notification-service internal APIs với internal JWT
4. Emit `notification:updated` đồng bộ tất cả tabs

**TODO chi tiết:**

- [ ] Tạo contracts trong `packages/contracts/src/ws/`:
  ```
  notification-read.ws.ts
  notification-read-all.ws.ts
  notification-updated.ws.ts
  index.ts (export all)
  ```

- [ ] Schema cho `notification:read` request:
  ```typescript
  export const WS_NOTIFICATION_READ = 'notification:read';
  export const NotificationReadRequestSchema = z.object({
    notificationId: z.string().uuid(),
  });
  ```

- [ ] Schema cho `notification:read-all` request:
  ```typescript
  export const WS_NOTIFICATION_READ_ALL = 'notification:read-all';
  // No payload needed, userId from socket auth
  ```

- [ ] Schema cho `notification:updated` broadcast:
  ```typescript
  export const WS_NOTIFICATION_UPDATED = 'notification:updated';
  export const NotificationUpdatedPayloadSchema = z.object({
    action: z.enum(['read', 'read-all']),
    notificationId: z.string().uuid().optional(), // only for 'read'
    unreadCount: z.number().int().min(0),
  });
  ```

- [ ] Trong `websocket.gateway.ts`:
  - `@SubscribeMessage('notification:read')` handler
  - `@SubscribeMessage('notification:read-all')` handler
  - Validate payload với Zod
  - Gọi notification-service internal API
  - Broadcast `notification:updated` đến **tất cả sockets** của user (sync tabs)

**Deliverables:**
- Client có thể gửi `notification:read` qua WS
- Client có thể gửi `notification:read-all` qua WS
- Tất cả tabs của user nhận `notification:updated` event

---

## Day 39 — Unread count realtime + bell sync

**Mục tiêu:**
- Đảm bảo updates lan truyền giữa các tabs của cùng user
- Bell icon luôn hiển thị đúng unreadCount

**TODO chi tiết:**

- [ ] Định nghĩa event `unreadCount:updated`:
  ```typescript
  export const WS_UNREAD_COUNT_UPDATED = 'unreadCount:updated';
  export const UnreadCountUpdatedSchema = z.object({
    count: z.number().int().min(0),
  });
  ```

- [ ] Khi có bất kỳ thay đổi nào ảnh hưởng unreadCount:
  - Notification mới (`notification:new`) → tăng count
  - Mark read (`notification:updated` action='read') → giảm count
  - Read all (`notification:updated` action='read-all') → count = 0

- [ ] Test với nhiều browser tabs:
  - Mở 2+ tabs đăng nhập cùng user
  - Thực hiện action trên 1 tab
  - Verify các tab khác cập nhật

**Deliverables:**
- Multi-tab sync hoạt động chính xác
- Bell icon count đồng bộ realtime

---

## Day 40 — WS hardening

**Mục tiêu:**
- Rate limit WS messages per user
- Handle disconnect cleanup properly
- Graceful reconnection

**TODO chi tiết:**

- [ ] Implement rate limiter cho WS messages:
  ```typescript
  // Simple in-memory rate limiter
  // Max 10 messages per second per user
  private readonly rateLimits = new Map<string, { count: number; resetAt: number }>();
  
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(userId);
    if (!limit || now > limit.resetAt) {
      this.rateLimits.set(userId, { count: 1, resetAt: now + 1000 });
      return true;
    }
    if (limit.count >= 10) return false;
    limit.count++;
    return true;
  }
  ```

- [ ] Cleanup Socket Registry khi disconnect:
  - Remove socket từ user's socket set
  - Nếu user không còn socket nào, remove user entry

- [ ] Handle reconnection:
  - Client tự động reconnect với JWT
  - Server accept reconnection và re-register socket

- [ ] Logging và monitoring:
  - Log connection/disconnection events
  - Track active connections count

**Deliverables:**
- WS rate limiting hoạt động
- Disconnect cleanup không leak memory
- Reconnection hoạt động smooth

---

## Day 41-42 — Buffer + load test

**Mục tiêu:**
- Simulate 50+ WS clients đồng thời
- Đảm bảo hệ thống ổn định

**TODO chi tiết:**

- [ ] Tạo script load test (có thể dùng Artillery hoặc custom script):
  ```bash
  # artillery config hoặc custom Node.js script
  # Simulate 50 concurrent WS connections
  # Each connection:
  #   1. Connect with JWT
  #   2. Listen for events
  #   3. Send periodic messages
  ```

- [ ] Metrics cần monitor:
  - Memory usage của gateway process
  - CPU usage
  - Response time của WS events
  - Connection success rate
  - Message delivery rate

- [ ] Fix issues phát sinh:
  - Memory leaks
  - Connection drops
  - Event loss

- [ ] Document kết quả load test

**Deliverables:**
- Load test script
- Report kết quả (pass/fail, metrics)
- Fixes cho issues phát hiện

---

## Cấu trúc thư mục cần tạo

```
apps/gateway/src/modules/
└── websocket/
    ├── websocket.module.ts
    ├── websocket.gateway.ts
    ├── socket-registry.service.ts
    └── jetstream-ws-consumer.service.ts

packages/contracts/src/
└── ws/
    ├── index.ts
    ├── notification-new.ws.ts
    ├── notification-read.ws.ts
    ├── notification-read-all.ws.ts
    ├── notification-updated.ws.ts
    └── unread-count-updated.ws.ts
```

---

## Dependencies cần cài đặt

```bash
# Gateway
cd apps/gateway
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# Types (nếu cần)
npm install -D @types/socket.io
```

---

## Thứ tự thực hiện đề xuất

### Giai đoạn 1: Hoàn thành nợ Tuần 5

1. **Day 32 (blocker):** Sửa `notification-service` để tạo welcome noti trong DB + publish `notification.created`
2. **Day 31:** Thêm `@RequirePermission` cho gateway notification endpoints
3. **Day 34:** Apply idempotency cho mark-read endpoint

### Giai đoạn 2: Tuần 6

4. **Day 36:** Setup WebSocket module, gateway, socket registry
5. **Day 37:** Subscribe `notification.created` + push realtime
6. **Day 38:** WS inbound handlers + contracts
7. **Day 39:** Multi-tab sync testing
8. **Day 40:** Hardening (rate limit, cleanup)
9. **Day 41-42:** Load testing

---

_File này được tạo ngày 2026-02-24 từ phân tích `DAILY_SCHEDULE_CORE_V1.md` và code thực tế._
