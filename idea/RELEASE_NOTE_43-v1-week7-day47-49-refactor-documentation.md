# Release Note

- **Release date**: 06/03/2026
- **Scope**: Documentation — Root README, docs/ folder (6 tài liệu), cập nhật idea/ trạng thái Week 7
- **Device**: Backend API (NestJS) — gateway, auth-service, notification-service (chỉ documentation, không thay đổi code runtime)
- **Branch**: `43-v1-week7-day-47-49-refactor-documentation`

## Overview

- Viết lại hoàn toàn **root `README.md`** — từ boilerplate NestJS thành tài liệu đầy đủ: architecture diagram, features, tech stack, quick start, API endpoints, CI badges.
- Tạo thư mục **`docs/`** với 6 tài liệu user-facing, quét từ code thực tế (không dựa hoàn toàn vào idea/):
  - `SETUP.md` — Hướng dẫn cài đặt, env vars, migrations, seed, troubleshooting.
  - `ARCHITECTURE.md` — System diagram, services, shared packages, DB schemas, data flows, event architecture.
  - `SECURITY.md` — JWT, refresh tokens, Argon2id, RBAC, internal JWT, rate limiting (Lua script), idempotency, security checklist.
  - `RBAC.md` — Data model (Mermaid ERD), PermissionCode enum, PermissionGuard flow, hướng dẫn thêm permission mới.
  - `TESTING.md` — Test strategy, existing test files, WS load test, CI integration, mocking guidelines.
  - `OPERATIONS.md` — Pino logging, ServiceError, health checks, BullMQ, NATS, Redis, common operations.
- Cập nhật 3 file trong **`idea/`** cho khớp trạng thái thực tế:
  - `WEEK7_STATUS_SUMMARY.md` — 0% → 98%.
  - `WEEK7_DAY43-49_PLAN.md` — Cập nhật checklist Day 43 ✅, Day 46 ✅, Day 47-49 ✅.
  - `WEEK7_TODOS_BY_DAY.md` — Cập nhật toàn bộ trạng thái theo từng ngày.

## Changes

### Root README.md (viết lại)

- **CI Badges**: `![CI]` + `![Lint]` badges từ GitHub Actions.
- **Architecture Overview**: ASCII diagram (Client → Gateway → Auth / Notification → PostgreSQL / Redis / NATS).
- **Service table**: Gateway (3000), Auth Service (3001), Notification Service (3002).
- **Features list**: Authentication, RBAC, WebSocket, Event-driven (NATS), BullMQ, Idempotency, Rate Limiting.
- **Tech Stack table**: 10+ công nghệ, phiên bản, mục đích.
- **Quick Start**: 6 bước (clone → install → docker → migrate → seed → run).
- **Scripts table**: Tất cả npm scripts có sẵn.
- **API Endpoints**: 3 bảng (Auth 9 endpoints, Roles 5 endpoints, Notifications 4 endpoints).
- **WebSocket Events**: Bảng events (notification:new, notification:read, notification:read-all, notification:updated, ping/pong).
- **Project Structure**: Tree view monorepo.
- **Documentation links**: Links tới 6 docs.

### docs/SETUP.md (mới)

- **Prerequisites** — Node ≥ 18.x, npm ≥ 9.x, Docker ≥ 24.x, Git.
- **Clone & Install** — `npm install` (hoisted workspaces).
- **Infrastructure** — `docker compose -f infra/docker-compose.dev.yml up -d`.
- **Environment Variables** — Bảng 17 env vars với description, default values.
- **Prisma Generate** — `npm run prisma:generate` (postinstall hook).
- **Migrations** — 3 services (`npm run migrate:auth`, `migrate:notification`, `migrate:gateway`).
- **Seed** — `npm run seed:auth` (2 users: admin + user, 3 roles, 12 permissions).
- **Start services** — `npm run dev:gateway/auth/notification`.
- **Verify** — curl commands kiểm tra health + login.
- **Troubleshooting** — 6 lỗi thường gặp (port conflict, Prisma client, NATS, Redis, migrations, node_modules).

### docs/ARCHITECTURE.md (mới)

- **System Overview** — ASCII diagram chi tiết (Gateway → Auth Service / Notification Service, NATS JetStream, Redis, PostgreSQL).
- **Gateway modules** — 7 modules (AuthClient, UserRoles, Notification, WebSocket, InternalJwt, Idempotency, RateLimiter).
- **Auth Service modules** — 4 modules (Auth, Role, NATS, Mail).
- **Notification Service modules** — 3 modules (Notification, JetStream, RateLimiter).
- **Shared packages** — `@common/core` (13 exports) + `@contracts/core` (4 exports).
- **Database Schemas** — auth (8 tables), notification (1 table), gateway (1 table).
- **Data Flows** — 3 diagrams: User Registration, Login, Notification → WebSocket Push.
- **Event Architecture** — NATS streams/consumers, BullMQ queues, subject patterns.
- **Technology Decisions** — Bảng giải thích lý do chọn mỗi công nghệ.

### docs/SECURITY.md (mới)

- **Authentication** — JWT HS256, refresh token rotation, per-device, HTTP-only cookie.
- **Password** — Argon2id (memoryCost 65536, timeCost 3, parallelism 4), AES-256-GCM encryption (forgot password tokens).
- **RBAC** — PermissionGuard, `@RequirePermission()`, permVersion tracking, Redis cache.
- **Internal JWT** — Zero-trust gateway → services, `@InternalOnly()` decorator, 5 min TTL.
- **Rate Limiting** — Redis Lua script (atomic INCR + TTL), `@RateLimit()` decorator, fail-open, keySource (`ip`, `userId`, `body.<field>`), response headers.
- **Rate Limit Rules** — Bảng chi tiết tất cả rules (login, register, resend-code, refresh, forgot-password, notifications, roles).
- **Defense-in-depth** — Rate limiting trên cả Gateway và Auth Service.
- **Input Validation** — class-validator, whitelist, forbidNonWhitelisted, transform.
- **Error Handling** — ServiceError + ErrorCodes, HttpExceptionFilter, không leak stack traces.
- **Idempotency** — SHA-256 fingerprint, conflict detection (409).
- **Security Checklist** — 14 items (✅ done / ⚠️ missing).

### docs/RBAC.md (mới)

- **Data Model** — Mermaid ERD (User, Role, Permission, UserRole, RolePermission).
- **PermissionCode enum** — 12 permissions liệt kê.
- **Seed data** — 3 roles (SUPER_ADMIN, ADMIN, USER), permission mappings.
- **PermissionGuard flow** — Extract JWT → check permVersion → load permissions (Redis cache) → verify.
- **Permission Cache** — Redis hash `perm:<userId>`, invalidate khi role thay đổi.
- **TokenTypeGuard** — `@Public()`, `@InternalOnly()`, `@UserOnly()` decorators.
- **How to add permissions** — 5 bước chi tiết (schema → seed → guard → controller → migrate).
- **API Endpoints** — 5 endpoints (list roles, get role, assign role, remove role, user roles).
- **Troubleshooting** — 3 vấn đề thường gặp (403, stale cache, permVersion mismatch).

### docs/TESTING.md (mới)

- **Test Strategy** — Unit (Jest), E2E (Supertest), Load (custom script).
- **Running Tests** — `npm run test`, `test:e2e`, `test:ws-load`, `test:cov`.
- **Existing Test Files** — 9 unit specs, 3 E2E specs, 1 load test script.
- **WS Load Test** — 6 phases (connect, authenticate, burst, gradual, sustained, disconnect).
- **CI Integration** — GitHub Actions matrix (Node 20.x/22.x), service containers.
- **Unit Test Example** — Code mẫu test auth service.
- **Mocking Guidelines** — Bảng service → mock strategy.
- **Test Configuration** — jest-e2e.json settings.

### docs/OPERATIONS.md (mới)

- **Logging** — Pino (JSON), log levels, RequestIdMiddleware, HttpLoggerInterceptor, sensitive field redaction.
- **Error Handling** — ServiceError codes (17 codes), HttpExceptionFilter behavior.
- **Health Checks** — `GET /` endpoints (3 services).
- **BullMQ** — mail-queue, job types, retry strategy (3 attempts, exponential backoff), DLQ.
- **Database** — Prisma commands (migrate dev/deploy/reset, studio).
- **NATS** — Monitoring (8222), stream info, consumer info.
- **Redis** — Key patterns (perm, rl, idempotent, bull).
- **Infrastructure** — docker-compose.dev.yml, ports, volumes.
- **Common Operations** — 5 operations (restart, logs, clear cache, check streams, reset DB).

### idea/ folder (cập nhật trạng thái)

- **WEEK7_STATUS_SUMMARY.md** — Header 0% → 98%, progress table, detailed status sections.
- **WEEK7_DAY43-49_PLAN.md** — Status line, Day 43 ✅, Day 46 ✅, Day 47-49 ✅, security issues updated, metrics updated, phase checklists updated, next steps updated.
- **WEEK7_TODOS_BY_DAY.md** — Header 0% → 98%, Day 43 ✅, Day 44 ⚠️ (bỏ qua), Day 45 ⚠️ (scaffold), Day 46 ✅, Day 47-49 ✅, summary table, blockers, success criteria.

## Migration

- **Migration required**: No (chỉ documentation, không thay đổi database hay code runtime)

## Dependencies

- **Added**: Không thêm package mới.
- **Unchanged**: Tất cả dependencies giữ nguyên.

## Affected files (tham khảo)

**Documentation (mới tạo)**

- `README.md` (viết lại hoàn toàn)
- `docs/SETUP.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RBAC.md`
- `docs/TESTING.md`
- `docs/OPERATIONS.md`

**idea/ (cập nhật trạng thái)**

- `idea/WEEK7_STATUS_SUMMARY.md`
- `idea/WEEK7_DAY43-49_PLAN.md`
- `idea/WEEK7_TODOS_BY_DAY.md`

## Thống kê

| Loại            | Số lượng      |
| --------------- | ------------- |
| Files mới       | 6 (docs/)     |
| Files viết lại  | 1 (README.md) |
| Files cập nhật  | 3 (idea/)     |
| Tổng insertions | ~2,732 dòng   |
| Tổng deletions  | ~859 dòng     |
