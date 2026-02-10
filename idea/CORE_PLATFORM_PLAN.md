# Core Platform (Core v1) — Nền tảng Backend dùng lại cho mọi dự án

> Mục tiêu: xây một “nền” backend **production-minded** để sau này làm dự án A/B/C chỉ cần **cắm service nghiệp vụ** vào, không phải viết lại auth, phân quyền, bảo mật, notification, realtime…

## 0) Yêu cầu đã chốt

- Framework: **NestJS (TypeScript)**
- Token: **Bearer token** (Authorization header)
- Email: **gửi email thật**
- Phân quyền: **permission theo action** (vd `posts:create`)
- DB: **PostgreSQL**
- Cache/Rate limit store: **Redis** (đề xuất cho rate limit nâng cao + cache permVersion/perms)
- ORM: **Prisma**
- Deploy: **VPS + Docker**
- Realtime noti web: **WebSocket 2 chiều**
- UI noti: **Bell icon list + unread count**

---

## 1) Ý tưởng tổng thể

Platform gồm các service core:

### Core v1 (chốt)

1. **API Gateway** (public entry)
2. **Auth Service** (identity & access)
3. **Notification Service** (in-app + realtime + email cho auth)

Các dự án sau này (Project A/B/C) sẽ là **service nghiệp vụ** thêm vào.

---

## 2) Monorepo (1 repo) nhưng vẫn microservice

Monorepo = 1 repo chứa nhiều app/service. Mỗi app vẫn:

- chạy port riêng
- build image riêng
- deploy container riêng
  ⇒ vẫn là microservice.

Cấu trúc repo đề xuất:

```
my-platform/
  apps/
    gateway/
    auth-service/
    notification-service/
    # (sau này) project-a-service/
  packages/
    common/         # logger, error system chuẩn, validation, helpers
    contracts/      # contract-first: events + payload schemas (+ gRPC proto nếu dùng)
  infra/
    docker-compose.dev.yml
    docker-compose.prod.yml
  README.md
  .env.example
```

### packages/contracts (contract-first) nên có gì?

Gợi ý cây thư mục để tránh “bắn JSON lung tung”:

```
packages/contracts/
  src/
    events/
      user.events.ts          # topic + payload type + (zod schema)
      notification.events.ts
    grpc/
      auth.proto              # (nếu dùng gRPC)
      notification.proto
    types/
      permission.ts           # Permission string types, helpers
      jwt-claims.ts           # JwtClaims/CurrentUser types
  index.ts                    # export tập trung
```

Quy ước:

- Topic (string) + payload type/schema nằm trong `events/*`
- Service publish/consume phải import từ `@contracts/...`
- Nếu đổi payload → TypeScript compile fail (và nếu có Zod schema thì runtime cũng chặn)

---

## 3) Giao tiếp giữa service

### Chuẩn hóa Error system (production-grade) 🔥

**Mục tiêu:** service nào cũng trả lỗi theo _cùng một ngôn ngữ_ (error code), gateway map/sanitize, không leak lỗi nội bộ.

Error response chuẩn (client-facing):

```json
{
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  },
  "traceId": "abc-123"
}
```

Nguyên tắc:

- **Error code** là contract (định nghĩa trong `packages/contracts` hoặc `packages/common`)
- Service nội bộ throw `ServiceError(code, httpStatus, safeMessage, details?)`
- Gateway nhận lỗi upstream:
  - nếu là `ServiceError` → map sang response chuẩn
  - nếu là lỗi lạ/timeout → trả code chung (`UPSTREAM_FAILURE`, `UPSTREAM_TIMEOUT`, `INTERNAL`)
- `details` chỉ dùng cho validation và phải sanitize
- Mọi log server đều có `traceId` để lần theo request

Gợi ý cấu trúc code:

- `packages/common/errors`:
  - `ErrorCodes` / `ErrorCode`
  - `ServiceError`
  - `errorToHttpResponse()`
  - `HttpExceptionFilter` (format hóa output)

> Nên làm từ Core v1 để khỏi refactor đau về sau.

### NATS làm event bus

- Auth publish event (vd `user.registered`)
- Notification consume event → tạo noti + gửi email
- Notification publish event `notification.created`
- Gateway subscribe `notification.created` → push realtime WebSocket

### Contract-first (bắt buộc) cho events 🔥

**Mục tiêu:** không cho service “tự bắn JSON lung tung”. Tất cả event + payload phải có **hợp đồng (contract)** chung.

- Định nghĩa topic + payload type trong `packages/contracts`
- Service publish/consume bắt buộc import contract từ `@contracts/...`
- Khi thay đổi payload → **TypeScript compile fail** ở các service chưa cập nhật → phát hiện bug sớm như team lớn

Ví dụ (contract):

```ts
// packages/contracts/src/events/user.events.ts
export const USER_REGISTERED = 'user.registered' as const;

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  createdAt: string; // ISO 8601
}
```

Publisher (auth-service) sẽ bị ép tạo đúng payload:

```ts
const event: UserRegisteredEvent = {
  userId,
  email,
  createdAt: new Date().toISOString(),
};
```

Consumer (notification-service) parse và dùng đúng kiểu:

```ts
const msg: UserRegisteredEvent = JSON.parse(raw);
```

> Nâng thêm “backend nâng cao” hơn: dùng **runtime validation** (Zod/Joi) ngay trong contracts để reject payload sai schema.

### Permission versioning (senior-level auth) 🔥

**Vấn đề của cách thường:** JWT nhét sẵn `roles/perms`. Nếu admin đổi quyền của user, các access token cũ vẫn còn hiệu lực cho tới khi hết hạn → cửa sổ rủi ro.

**Ý tưởng nâng cấp:** JWT **không (hoặc ít) chứa perms**, chỉ chứa `permVersion`.

- Trong DB, user (hoặc user-permission snapshot) có trường `permVersion`.
- Mỗi khi đổi role/permission của user → **tăng `permVersion`**.
- Gateway (hoặc auth guard) khi nhận request sẽ:
  1. verify JWT
  2. so sánh `jwt.permVersion` với `db.permVersion`
  3. lệch version → coi như token cũ **tự invalid** (yêu cầu login/refresh lại)

**Ví dụ claim trong JWT:**

```ts
// access token payload
{ sub: userId, permVersion: 7, iat: ..., exp: ... }
```

**Ví dụ DB:**

- `User.permVersion` (int, default 1)

**Flow đổi quyền:**

- Admin cập nhật role/permission → transaction:
  - update mapping tables
  - `User.permVersion += 1`

**Ưu điểm:**

- Đổi quyền có hiệu lực gần như ngay (khỏi chờ token hết hạn)
- Không cần blacklist từng access token

**Trade-off (đổi lại):**

- Mỗi request phải check version (tốn 1 lần đọc DB/Redis). Thực tế thường cache `permVersion` (Redis) để nhanh.

> Khuyến nghị cho Core v1: có thể **để access token ngắn (10–15p)** + refresh rotation. Core v1.1 nâng lên permission versioning nếu ba muốn “cứng” như hệ lớn.

### Refresh token reuse detection (v1.1, advanced security) 🔥

**Bối cảnh:** Refresh token thường sống lâu (7–30 ngày). Nếu refresh token bị đánh cắp, kẻ xấu có thể xin access token mới.

**Rotation cơ bản (Core v1):** mỗi lần refresh → cấp refresh token mới, revoke token cũ.

**Vấn đề:** nếu token cũ đã bị đánh cắp, kẻ xấu có thể thử dùng lại token cũ sau khi user đã refresh.

**Reuse detection (nâng cao):**

- Mỗi refresh token gắn với một `sessionId` (hoặc record Session) và lưu **hash** trong DB.
- Khi client gọi `POST /auth/refresh` với refresh token:
  1. Tìm session tương ứng (thường bằng `sessionId` nằm trong refresh token hoặc lookup theo hash)
  2. Nếu session đã **revoked/rotated** mà token này vẫn được dùng → kết luận **token bị reuse**
  3. Hành động phản ứng: **revoke toàn bộ session của user** (logout-all) + ghi audit log (security.alert)

**Lợi ích:**

- Nếu refresh token bị lộ và bị dùng lại → hệ thống tự “đóng cửa” ngay, giảm rủi ro chiếm tài khoản dài hạn.

**Gợi ý triển khai (Core v1.1):**

- Bảng `Session` có:
  - `id` (sessionId)
  - `userId`
  - `refreshTokenHash`
  - `revokedAt`
  - `replacedBySessionId` (optional)
- Refresh token format nên chứa `sessionId` + `secret`:
  - client gửi token → server parse sessionId → verify secret bằng hash

> Core v1: làm refresh rotation + logout-all. Core v1.1: thêm reuse detection + security alert.

---

## 4) Core v1 — Chi tiết từng service

### 4.1 API Gateway

Vai trò: cổng vào duy nhất cho client (public REST + WebSocket).

Chuẩn hóa Error system (Gateway là điểm “sanitize”):

- Gateway trả error theo format thống nhất: `{ error: { code, message, details? }, traceId }`
- Lỗi từ service nội bộ (auth/notification) phải được **mapping** sang error code chuẩn
- Không leak internal error (stacktrace/SQL/hostnames) ra client
- TraceId/RequestId luôn gắn vào response để debug

Chức năng (Core v1):

- Public REST API
- Verify JWT access token (Bearer)
- **Check permission theo action** cho từng endpoint
- Rate limit endpoint nhạy cảm (login/forgot/reset)
- Chuẩn response/error format + requestId
- WebSocket 2 chiều:
  - Auth socket bằng access token (khuyên: client gửi message `AUTH {token}` sau khi connect)
  - Map `userId -> socketId(s)` (nhiều tab/thiết bị)
  - Push realtime noti
  - Nhận event 2 chiều: `notification:read`, `notification:read-all`

Tích hợp “nâng cao” (đưa vào thiết kế để dùng lâu dài):

- **Contract-first:** event WS + event NATS nên dùng type/schema từ `packages/contracts` (không tự bắn JSON lung tung)
- **Permission versioning (tuỳ bật ở v1 hoặc v1.1):** nếu JWT có `permVersion`, gateway có thể so với DB/Redis để auto-invalidate token khi đổi quyền
- **Idempotency cho endpoint quan trọng (production-grade):**
  - Client gửi header `Idempotency-Key: <uuid>`
  - Gateway lưu key + requestHash + response; request trùng → trả response cũ
  - Dùng cho các hành động dễ bị gửi lại: tạo booking/payment (sau này), mark read, reset password…
  - Quy tắc: cùng key mà payload khác → trả 409 (Conflict)
  - TTL (vd 24h) để không phình DB
- **Rate limit nâng cao (không chỉ IP) 🔥**
  - Limit theo: `userId` (đã login), `email` (login/forgot), `endpoint/action`, và IP (phụ)
  - Nên dùng **Redis-based** để share limit giữa nhiều instance
  - Thuật toán: sliding window / token bucket (có thể bắt đầu đơn giản rồi nâng cấp)
  - Ưu tiên áp dụng cho endpoint nhạy cảm: `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/refresh`
  - Không leak thông tin: trả 429 với message chung, log nội bộ kèm traceId
- **Zero-trust nội bộ (service→service) 🔥**
  - Không tin “cùng mạng Docker/VPS là an toàn”
  - **Core v1:** dùng **internal JWT** cho các call nội bộ (gateway→auth/noti)
    - service nội bộ chỉ nhận request có `Authorization: Bearer <internal-jwt>`
    - verify `iss/aud/scope/exp` (exp ngắn 30–60s)
    - tách bạch client JWT (user) vs internal JWT (service identity)
  - **Core v1.1:** nâng cấp **mTLS** giữa services + quản lý cert/rotation

Public endpoints (ví dụ):

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `GET  /me`

Notification (bell):

- `GET  /notifications?status=unread|all&page=&limit=`
- `GET  /notifications/unread-count`
- `POST /notifications/:id/read`
- `POST /notifications/read-all`

---

### 4.2 Auth Service

Vai trò: đăng ký/đăng nhập/phiên đăng nhập + phân quyền (identity & access).

Token model (Core v1):

- Access token: JWT 10–15 phút
- Refresh token: random string 7–30 ngày
- Refresh token lưu DB dạng **hash (argon2id)**
- Refresh rotation (refresh -> cấp refresh mới, revoke cũ)

Password security:

- Hash: **argon2id**
- Chống enumeration: message chung cho login/forgot

Forgot/Reset password chuẩn:

- Token random 32–64 bytes
- Lưu **hash** + expiry 10–30 phút
- Reset thành công → đổi password + revoke all sessions

Permission theo action (Core v1):

- Role là nhóm quyền
- Permission dạng `resource:action`

JWT payload (gợi ý để nâng trình):

- Tối thiểu: `{ sub: userId, permVersion, exp, iat }`
- Không bắt buộc nhét perms vào JWT (tuỳ chọn). Có thể cache perms tại gateway.

Permission versioning (thiết kế sẵn cho v1.1):

- DB có `User.permVersion`
- Mỗi lần đổi role/permission → `permVersion++`
- Token cũ tự invalid khi gateway so version

Audit log:

- actorUserId, action, target, ip, userAgent, createdAt, traceId

---

### 4.3 Notification Service

Vai trò: thông báo đa kênh (Core v1 ưu tiên **in-app + realtime + email auth**).

In-app notifications:

- DB: `notifications` (id, userId, type, title, body, data json, createdAt, readAt)
- API nội bộ cho gateway: list, unread count, mark read, read-all

Realtime:

- Nhận event từ service khác (vd auth) qua NATS (contract-first)
- Tạo notification record
- Publish event `notification.created` (contract-first)
- Gateway subscribe và emit WS `notification:new` cho user online
- Client gửi `notification:read` (2 chiều) → gateway gọi notification-service update DB

Email:

- Gửi email thật cho verify/reset

Background jobs / retry system (production-grade) 🔥

- Email/notification không nên xử lý sync trong request → dùng job queue
- Dùng **BullMQ (Redis)** hoặc worker riêng (khuyên: BullMQ vì đã có Redis)
- Có retry với backoff (vd 1m → 5m → 15m → 1h)
- Có **dead-letter queue (DLQ)**: quá số lần retry → chuyển sang DLQ + log/audit để xử lý/replay
- Payload job nên contract-first + validate (Zod) để tránh job bẩn

---

## 5) Data model (Prisma) — khung bảng

Auth DB:

- User
- Session (refreshTokenHash, expiresAt, revokedAt, ip, userAgent)
- PasswordResetToken (tokenHash, expiresAt, usedAt)
- Role, Permission, RolePermission, UserRole (+ optional UserPermission)
- AuditLog

Notification DB:

- Notification

---

## 6) Cách “cắm” dự án A vào nền (ví dụ cụ thể)

Ví dụ Project A: Booking Service

1. Thêm `apps/booking-service`
2. Booking expose gRPC nội bộ (hoặc HTTP nội bộ)
3. Gateway thêm route public:
   - `POST /bookings` (require `bookings:create`)
4. Gateway verify token + check permission → gọi booking-service
5. Booking publish event `booking.created` → notification-service tạo noti

---

## 7) Kế hoạch 2 tháng (8 tuần)

Tuần 1: monorepo + docker dev (postgres + nats) + prisma schema + common libs
Tuần 2: register/login + access/refresh rotation + gateway verify token
Tuần 3: forgot/reset + SMTP email thật + template
Tuần 4: permission theo action + guard/decorator + audit log
Tuần 5: notification in-app (bell list) + APIs
Tuần 6: websocket realtime + event flow auth→noti→gateway push
Tuần 7: hardening (rate limit, session revoke) + e2e tests + CI
Tuần 8: deploy VPS bằng Docker + HTTPS + docs “plug new service”

---

## 8) Core v1.1 (sau khi v1 chạy ổn)

### 8.1 Observability thật sự (logs – metrics – tracing) 🔥

**Vì sao cần?** Senior hay hỏi: _“User báo lỗi, m debug kiểu gì?”_ — Observability là câu trả lời.

Observability có 3 mảnh ghép:

1. **Structured logging (JSON logs + traceId/requestId)**

- Log dạng JSON để search/filter dễ
- Mỗi request có `requestId`/`traceId` gắn vào log
- Có thể grep theo `traceId` để ra toàn bộ log của 1 request xuyên services

2. **Distributed tracing (gateway → auth → notification)**

- 1 request tạo 1 **trace** gồm nhiều **span** (gateway span, auth span, DB span, publish/consume NATS span…)
- Khi chậm/lỗi, nhìn timeline biết nghẽn ở đâu
- Dùng **OpenTelemetry** để instrument, export sang **Jaeger** hoặc **Tempo**

3. **Metrics (Prometheus)**

- Đo: request count, latency (p95/p99), error rate, WS connections…
- Grafana dashboard để nhìn hệ thống theo thời gian

**Nên làm ở version nào?**

- **Core v1 (tối thiểu bắt buộc để debug được):**
  - JSON logging thống nhất cho 3 service
  - `requestId` (gateway tạo) + propagate sang auth/noti
  - Log không leak secrets (token/password)
- **Core v1.1 (đúng “backend nâng cao”):**
  - OpenTelemetry tracing end-to-end + Jaeger/Tempo
  - Prometheus + Grafana metrics
  - Propagate trace context qua HTTP/gRPC và **NATS JetStream headers**

> Stack gợi ý: OpenTelemetry + Jaeger (dễ bắt đầu) + Prometheus + Grafana.

### 8.2 Các gói nâng cấp khác

1. File/Media Service (MinIO/S3 presigned upload)
2. Template/generator tạo service mới + contract mẫu + permission mẫu
3. Security nâng cao (refresh reuse detection, device sessions, audit nâng cao)
4. Mở rộng Idempotency:
   - phủ lên toàn bộ endpoint tạo side-effect
   - có requestHash + TTL cleanup job
   - metrics/alert cho conflict/replay rate
5. Error system nâng cao:
   - metrics theo `error.code` (đếm error rate theo code)
   - mapping chuẩn cho gRPC/NATS errors
   - docs cho frontend (bảng code → hành vi UI)
6. Background jobs nâng cao:
   - Bull Board dashboard + job replay
   - metrics job success/fail + alert
   - idempotency cho job gửi email (tránh gửi trùng)
7. Zero-trust nâng cao:
   - mTLS giữa services (gRPC/HTTP)
   - service identity + policy (ai được gọi ai)

---

## 9) Việc cần chốt khi bắt đầu code

✅ Ba đã chốt:

1. **NATS JetStream**
2. **DB dùng chung 1 Postgres instance, tách schema theo service** (auth schema, notification schema, …)
3. SMTP: **Gmail (App Password)**
4. Package manager: **npm**
