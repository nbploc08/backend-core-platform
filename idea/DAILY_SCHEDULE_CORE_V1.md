# DAILY_SCHEDULE_CORE_V1 — Roadmap tổng + Todo list theo từng ngày (Core Platform v1)

> Dựa trên: `D:\project core\CORE_PLATFORM_PLAN.md`
>
> Mục tiêu Core v1: **Auth + Gateway + Notification** chạy production‑minded, có: contract‑first, error system chuẩn, redis‑based rate limit + bullmq jobs, websocket bell notifications, zero‑trust internal JWT.

---

## 0) Stack & quyết định đã chốt (đã phản ánh trong lịch)
- NestJS + TypeScript, npm workspaces
- PostgreSQL **1 instance** (tách schema: `auth`, `notification`)
- Prisma
- NATS **JetStream** (event bus)
- Redis (rate limit/caching + BullMQ job queue)
- Email: Gmail App Password
- WebSocket 2 chiều (bell icon list + unread count)
- Contract‑first + Zod validation trong `packages/contracts`
- Error system chuẩn (error code + sanitize + traceId)
- Zero‑trust nội bộ: **internal JWT** cho gateway→auth/noti

---

## 1) Roadmap tổng (8 tuần / 56 ngày)

### Tuần 1 — Khởi tạo repo/infra + common libs (contracts, errors, logging)
- Monorepo + docker infra (postgres+schemas, nats jetstream, redis)
- `packages/common`: structured logging JSON + requestId/traceId + error system chuẩn
- `packages/contracts`: events + schemas + (chuẩn bị ws payloads)
- Skeleton 3 apps chạy health

### Tuần 2 — Auth core: register/login + JWT + sessions + gateway verify
- User + hash argon2id
- JWT access (15m) + refresh token stored hashed
- session revoke + logout
- gateway verify JWT + requestId propagation

### Tuần 3 — Forgot/Reset + Email async bằng BullMQ (retry/backoff + DLQ)
- reset token hashed + expiry
- send mail qua worker (bullmq)
- audit log actions

### Tuần 4 — RBAC/Permission theo action + permVersion (ready) + gateway BFF + zero‑trust
- Role/Permission tables + decorator
- permVersion field + update flow (ready)
- gateway forward `/auth/*` sang auth-service với internal JWT
- auth/noti internal endpoints verify internal JWT

### Tuần 5 — Notification in-app (bell list) + events (NATS) + APIs
- noti DB model + list/unread/read/read-all
- consume `user.registered` → create welcome noti + enqueue email (optional)
- publish `notification.created`
- (bắt đầu) Idempotency framework cho endpoint quan trọng

### Tuần 6 — Realtime WS + contract-first cho WS payload + idempotency
- ws auth (client JWT), mapping user→sockets
- push `notification.created` realtime
- ws read/read-all 2 chiều + đồng bộ nhiều tab
- idempotency cho mark-read / read-all (demo production)

### Tuần 7 — Hardening: advanced rate limit (user/email/action) + headers + e2e + CI
- redis sliding window/token bucket (đơn giản trước, có thể nâng)
- helmet + cors allowlist
- e2e full flows
- github actions

### Tuần 8 — Docker prod + HTTPS + vận hành + docs “plug service mới”
- Dockerfiles, compose prod
- Caddy/Nginx reverse proxy + HTTPS
- deploy guide step-by-step
- runbook + demo

---

## 2) Quy ước vận hành mỗi ngày
- Mỗi ngày kết thúc: commit nhỏ, message rõ (vd `feat(auth): add refresh rotation`)
- Luôn chạy nhanh: `npm test` (hoặc ít nhất e2e smoke) với phần vừa làm
- Không commit secret, chỉ `.env.example`

---

# TUẦN 1 — Repo/Infra + Common (errors/logging/contracts)

### Day 1 — Init monorepo + gateway hello
**Mục tiêu:** repo chạy được 1 app.
**Todo chi tiết:**
1) Init git + root `package.json` (npm workspaces: `apps/*`, `packages/*`).
2) Tạo folders: `apps`, `packages`, `infra`.
3) Generate Nest app `apps/gateway`.
4) Add route `GET /health`.
5) Root scripts: `dev:gateway`, `build`, `test` placeholders.
**Done:** `npm run dev:gateway` và `/health` OK.

### Day 2 — Docker dev infra: Postgres (schemas) + NATS JetStream + Redis
**Mục tiêu:** chạy infra local bằng docker.
**Todo chi tiết:**
1) Tạo `infra/docker-compose.dev.yml` gồm:
   - `postgres` (1 instance)
   - `nats` bật JetStream (`-js`)
   - `redis`
2) Postgres init schemas:
   - tạo `auth`, `notification` (init script `infra/sql/init.sql`).
3) Viết `.env.example` (DB URLs, NATS, REDIS).
4) README: cách `up -d`.
**Done:** docker up ổn, connect postgres, ping redis, nats ready.

### Day 3 — packages/common: Structured logging + requestId/traceId skeleton
**Mục tiêu:** log JSON thống nhất và có requestId.
**Todo chi tiết:**
1) Tạo `packages/common` (tsconfig, build).
2) Chọn logger (khuyên pino). Chuẩn JSON logs.
3) Middleware/interceptor tạo `requestId` (uuid) cho mọi request gateway.
4) Propagate `requestId` sang outbound calls (headers).
5) Bảo đảm log không leak token/password.
**Done:** gateway log JSON có `requestId`.

### Day 4 — Error system chuẩn (codes + ServiceError + filters)
**Mục tiêu:** chuẩn hóa lỗi theo error code + traceId.
**Todo chi tiết:**
1) Trong `packages/common/errors`:
   - `ErrorCodes` (AUTH_INVALID_CREDENTIALS, VALIDATION_ERROR, INTERNAL, ...)
   - `ServiceError` (code, httpStatus, safeMessage, details?)
   - `HttpExceptionFilter` map mọi lỗi → format chuẩn.
2) Gateway dùng filter: `{ error: { code, message, details? }, traceId/requestId }`.
3) Quy ước sanitize: lỗi lạ → `INTERNAL` + message chung.
**Done:** throw ServiceError trả format đúng; lỗi lạ không leak stacktrace.

### Day 5 — packages/contracts: contract-first events + zod schemas
**Mục tiêu:** không bắn JSON lung tung.
**Todo chi tiết:**
1) Tạo `packages/contracts` với:
   - `events/user.events.ts` (`USER_REGISTERED` + schema)
   - `events/notification.events.ts` (`NOTIFICATION_CREATED` + schema)
2) Export tập trung `index.ts`.
3) Viết helper validate: `Schema.parse()`.
**Done:** auth/noti import được contracts + zod parse.

### Day 6 — Auth-service skeleton + Prisma schema `auth`
**Mục tiêu:** auth service chạy + migrate vào schema `auth`.
**Todo chi tiết:**
1) Generate `apps/auth-service` + `/health`.
2) Prisma init: `schema.prisma` (User tối thiểu).
3) `DATABASE_URL_AUTH` set `search_path=auth`.
4) `prisma migrate dev` tạo bảng trong schema auth.
**Done:** service chạy + bảng nằm đúng schema.

### Day 7 — Notification-service skeleton + Prisma schema `notification`
**Mục tiêu:** notification service chạy + migrate đúng schema.
**Todo chi tiết:**
1) Generate `apps/notification-service` + `/health`.
2) Prisma init `schema.prisma` (Notification tối thiểu).
3) `DATABASE_URL_NOTI` set `search_path=notification`.
4) `prisma migrate dev`.
**Done:** service chạy + bảng đúng schema notification.

---

# TUẦN 2 — Auth core + Gateway verify

### Day 8 — User model + argon2id + validation DTO
1) Prisma User: id(uuid), tenant? (skip), email unique (theo schema), passwordHash, permVersion default 1, status.
2) DTO validate email/password policy.
3) Hash/verify argon2id.
**Done:** tạo user + verify OK.

### Day 9 — Register endpoint + publish event contract-first
1) `POST /auth/register`.
2) Normalize email, check unique.
3) Create user.
4) Publish `USER_REGISTERED` vào NATS JetStream (payload validate).
5) Audit log: user.registered.
**Done:** register 201 + event xuất hiện.

### Day 10 — Login endpoint + error code chuẩn
1) `POST /auth/login`.
2) Fail → `AUTH_INVALID_CREDENTIALS` message chung.
3) Success → trả access+refresh (tạm stub).
4) Audit log login_success/login_failed.
**Done:** login chuẩn error response.

### Day 11 — JWT access token + guards
1) JWT config: secret/issuer/audience.
2) Claims: sub, permVersion, iat, exp.
3) Guard verify JWT.
4) Endpoint `GET /me` trả userId.
**Done:** verify JWT OK.

### Day 12 — Session table + refresh token hashed
1) Prisma Session: id, userId, refreshTokenHash, expiresAt, revokedAt, ip, userAgent.
2) Khi login: tạo refresh token random + hash lưu session.
3) Return refresh token.
**Done:** login tạo session.

### Day 13 — Refresh rotation + logout/logout-all
1) `POST /auth/refresh`: verify refresh token, rotate.
2) `POST /auth/logout`: revoke session.
3) `POST /auth/logout-all`: revoke all sessions.
4) Ensure error codes chuẩn.
**Done:** refresh cũ bị revoke.

### Day 14 — Gateway verify JWT + requestId propagation
1) Gateway middleware requestId.
2) Gateway verify JWT cho `/me`.
3) Gateway chuẩn error system + sanitize.
4) (Optional) gateway call auth-service internal endpoint for profile.
**Done:** client gọi gateway `/me` OK.

---

# TUẦN 3 — Forgot/Reset + Email async qua BullMQ

### Day 15 — Add Redis client + BullMQ queue skeleton
1) In infra: redis đã có. Thêm config trong services.
2) notification-service tạo BullMQ queue `email`.
3) Tạo worker process (có thể là module chạy cùng service hoặc app riêng `apps/notification-worker`).
4) Healthcheck worker.
**Done:** enqueue job test và worker nhận.

### Day 16 — Gmail App Password + nodemailer adapter
1) Setup env SMTP Gmail.
2) Viết mailer adapter (sendMail).
3) Worker thực hiện job `email.sendTest`.
**Done:** gửi mail test thành công.

### Day 17 — PasswordResetToken model (hash + expiry)
1) Prisma PasswordResetToken: tokenHash, expiresAt, usedAt.
2) Helper generate token random 32–64 bytes.
**Done:** tạo token record OK.

### Day 18 — Forgot password endpoint (anti-enumeration) + enqueue email job
1) `POST /auth/forgot-password` luôn trả OK.
2) Nếu email tồn tại: create reset token.
3) Enqueue BullMQ job `email.sendReset` (payload contract-first + validate).
4) Retry/backoff config (attempts, backoff).
**Done:** request trả nhanh; email gửi qua worker.

### Day 19 — Reset password endpoint + revoke sessions
1) `POST /auth/reset-password` verify token (hash compare).
2) Update passwordHash.
3) Mark token used.
4) Revoke all sessions.
**Done:** token one-time; session bị revoke.

### Day 20 — DLQ (dead-letter) + audit for email failures
1) BullMQ config: attempts/backoff.
2) On failed after N attempts: move to DLQ queue (hoặc mark failed + store reason).
3) Audit log `email.failed` với traceId.
**Done:** mô phỏng SMTP fail → job vào DLQ.

### Day 21 — Buffer + e2e forgot/reset
- e2e: forgot/reset, ensure anti-enumeration.
- verify no secret leaks.

---

# TUẦN 4 — RBAC + permVersion ready + gateway BFF + zero-trust internal JWT

### Day 22 — RBAC tables + seed roles/perms
1) Prisma: Role, Permission, RolePermission, UserRole.
2) Seed perms tối thiểu: `notifications:read`, `notifications:write`.
3) Seed roles: admin/user.
**Done:** assign role works.

### Day 23 — Permission guard + decorator
1) Decorator `@RequirePermissions()`.
2) Guard fetch perms (DB) + cache (optional) in Redis.
3) Error code `FORBIDDEN` chuẩn.
**Done:** endpoint protected theo permission.

### Day 24 — permVersion behavior (ready)
1) User.permVersion default 1.
2) Khi đổi role/perms: transaction + permVersion++.
3) JWT include permVersion.
**Done:** permVersion tăng khi đổi quyền.

### Day 25 — Gateway BFF forward `/auth/*` (internal call)
1) Gateway routes `/auth/*` forward sang auth-service.
2) Mapping errors upstream → error system chuẩn.
3) Propagate requestId/traceId headers.
**Done:** client chỉ gọi gateway vẫn register/login/refresh.

### Day 26 — Zero-trust internal JWT (service→service)
1) Define internal JWT issuer/secret.
2) Gateway khi gọi auth/noti internal endpoints gửi `Authorization: Bearer <internal-jwt>`.
3) Auth-service & notification-service middleware verify internal JWT (iss/aud/scope/exp).
4) Reject internal calls thiếu token.
**Done:** direct call to auth internal endpoint without token → 401.

### Day 27 — Redis cache permVersion/perms (if enabled)
1) Cache key `permVersion:<userId>` TTL.
2) Cache perms snapshot keyed by userId+permVersion.
3) Invalidate on perm change.
**Done:** perms lookup fast.

### Day 28 — Buffer + docs RBAC
- README: permission model + adding new permission.

---

# TUẦN 5 — Notification in-app + NATS events + idempotency framework

### Day 29 — Notification schema đầy đủ + indexes
1) Prisma Notification: id, userId, type, title, body, data json, createdAt, readAt.
2) Index: (userId, readAt, createdAt).
**Done:** migrate OK.

### Day 30 — Notification-service internal APIs (list/unread/read/read-all)
1) Internal endpoints (require internal JWT):
   - list, unreadCount, markRead, readAll.
2) Return formats chuẩn.
**Done:** gateway can call internal endpoints.

### Day 31 — Gateway public APIs bell list + permission check
1) Public endpoints `/notifications`.
2) Permission: `notifications:read`.
3) Map internal errors.
**Done:** list/unread endpoints work.

### Day 32 — Consume `USER_REGISTERED` (JetStream) → create welcome notification
1) Notification subscribe `user.registered`.
2) Zod validate payload.
3) Create welcome notification.
4) Publish `notification.created` event.
**Done:** register triggers welcome noti.

### Day 33 — Idempotency framework (store & replay) in gateway
1) Add table (schema auth or common) `IdempotencyKey` (decide schema: `auth` is fine).
2) Middleware/interceptor:
   - read header `Idempotency-Key`
   - compute requestHash
   - store processing/completed + response
   - replay if duplicate
   - 409 if same key different payload.
**Done:** duplicate request returns same response.

### Day 34 — Apply idempotency to `POST /notifications/:id/read` (demo)
1) Turn on idempotency for markRead.
2) Test: send same key twice → no double updates.
**Done:** idempotency works.

### Day 35 — Buffer + pagination polish
- stable pagination + sorting.

---

# TUẦN 6 — Realtime WebSocket + contract-first WS payloads

### Day 36 — WS auth + socket registry
1) WS server in gateway.
2) Client sends `AUTH {token}`.
3) Verify JWT, map userId→sockets.
**Done:** authenticated WS connections.

### Day 37 — Subscribe `notification.created` → push WS `notification:new`
1) Gateway subscribe JetStream.
2) Emit to all sockets of user.
3) Include unreadCount update.
**Done:** realtime push works.

### Day 38 — WS inbound: `notification:read` / `read-all`
1) Define WS payload contract in `packages/contracts`.
2) Validate inbound messages.
3) Gateway calls notification internal endpoints with internal JWT.
4) Emit `notification:updated` to sync tabs.
**Done:** mark read via WS works.

### Day 39 — Unread count realtime + bell sync
- ensure updates propagate across tabs.

### Day 40 — WS hardening
- rate limit WS messages per user (light)
- handle disconnect cleanup

### Day 41–42 — Buffer + load test
- simulate 50 ws clients.

---

# TUẦN 7 — Hardening: advanced rate limit + security headers + e2e + CI

### Day 43 — Advanced rate limiting (Redis) per email/user/action
1) Implement rate limiter using Redis (atomic Lua or simple INCR+EXPIRE).
2) Keys:
   - `rl:login:ip:<ip>`
   - `rl:login:email:<hash>`
   - `rl:forgot:email:<hash>`
   - `rl:api:<userId>:<action>`
3) Return 429 with generic message; log internal with traceId.
**Done:** brute force protected.

### Day 44 — Helmet + CORS allowlist
- security headers.

### Day 45 — E2E tests full flows
- auth flows + notification list + WS.

### Day 46 — CI GitHub Actions
- install, lint, test.

### Day 47–49 — Refactor + docs hardening
- docs security & operations.

---

# TUẦN 8 — Deploy VPS + HTTPS + docs plug-in

### Day 50 — Dockerfiles multi-stage

### Day 51 — docker-compose.prod (postgres + schemas + nats + redis)

### Day 52 — Caddy/Nginx + HTTPS

### Day 53 — Deploy guide step-by-step

### Day 54 — Runbook vận hành

### Day 55 — Docs: How to add Project A service

### Day 56 — Final review + demo

---

## 3) Ghi chú: v1.1 (sau khi xong v1)
- Observability full (OpenTelemetry + Jaeger + Prometheus/Grafana)
- Refresh token reuse detection chuẩn
- mTLS nội bộ
- Bull board + job metrics
