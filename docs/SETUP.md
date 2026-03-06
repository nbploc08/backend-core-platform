# Setup Guide

Hướng dẫn cài đặt và chạy dự án Backend Core Platform trên máy local.

---

## Prerequisites

| Tool               | Version | Mục đích                              |
| ------------------ | ------- | ------------------------------------- |
| **Node.js**        | ≥ 18.x  | Runtime                               |
| **npm**            | ≥ 9.x   | Package manager (monorepo workspaces) |
| **Docker**         | ≥ 24.x  | PostgreSQL, Redis, NATS containers    |
| **Docker Compose** | ≥ 2.x   | Orchestrate dev infrastructure        |
| **Git**            | ≥ 2.x   | Source control                        |

---

## 1. Clone & Install

```bash
git clone <repo-url>
cd backend-core-platform
npm install
```

> `npm install` sẽ cài tất cả dependencies cho root, `apps/*`, và `packages/*` nhờ npm workspaces. Lệnh `postinstall` tự động chạy `patch-package` để apply patches.

---

## 2. Start Infrastructure

```bash
docker compose -f infra/docker-compose.dev.yml up -d
```

Lệnh trên sẽ khởi động:

| Service           | Container       | Port       | Mô tả                                           |
| ----------------- | --------------- | ---------- | ----------------------------------------------- |
| **PostgreSQL 16** | `core_postgres` | 5433→5432  | Database (schemas: auth, notification, gateway) |
| **NATS 2.10**     | `core_nats`     | 4222, 8222 | JetStream event bus + monitoring                |
| **Redis 7**       | `core_redis`    | 6379       | Rate limiting + permission cache                |

Kiểm tra containers đã chạy:

```bash
docker ps
```

PostgreSQL tự động tạo schemas `auth` và `notification` thông qua file `infra/sql/init.sql`.

---

## 3. Environment Variables

### Copy template

```bash
# Root
cp .env.example .env

# Per-service (nếu cần override)
cp apps/auth-service/.env.example apps/auth-service/.env
cp apps/gateway/.env.example apps/gateway/.env
cp apps/notification-service/.env.example apps/notification-service/.env
```

### Biến môi trường chính

| Variable                   | Service                     | Default                  | Mô tả                             |
| -------------------------- | --------------------------- | ------------------------ | --------------------------------- |
| `PORT`                     | All                         | 3000/3001/3002           | HTTP port                         |
| `DATABASE_URL`             | All                         | —                        | PostgreSQL connection string      |
| `REDIS_URL`                | Auth, Gateway, Notification | `redis://localhost:6379` | Redis connection                  |
| `NATS_URL`                 | All                         | `nats://localhost:4222`  | NATS JetStream connection         |
| `JWT_SECRET`               | All                         | —                        | User JWT signing/verification     |
| `JWT_EXPIRES_IN`           | Auth                        | `9000s`                  | Access token TTL                  |
| `JWT_REFRESH_EXPIRES_IN`   | Auth                        | `604800s`                | Refresh token TTL (7 days)        |
| `JWT_ISSUER`               | All                         | `auth-service`           | JWT issuer claim                  |
| `JWT_AUDIENCE`             | All                         | `api`                    | JWT audience claim                |
| `INTERNAL_JWT_SECRET`      | All                         | —                        | Internal service-to-service JWT   |
| `INTERNAL_JWT_ISSUER`      | All                         | `gateway`                | Internal JWT issuer               |
| `INTERNAL_JWT_AUDIENCE`    | All                         | `internal`               | Internal JWT audience             |
| `AUTH_SERVICE_URL`         | Gateway                     | `http://localhost:3001`  | Auth service proxy target         |
| `NOTIFICATION_SERVICE_URL` | Gateway                     | `http://localhost:3002`  | Notification service proxy target |
| `MAIL_USER`                | Notification                | —                        | Gmail SMTP email                  |
| `MAIL_APP_PASSWORD`        | Notification                | —                        | Gmail app-specific password       |
| `ENCRYPT_KEY`              | Auth, Notification          | —                        | AES-256-GCM encryption key        |
| `LOG_LEVEL`                | All                         | `info`                   | Pino log level                    |
| `SERVICE_NAME`             | All                         | —                        | Pino service identifier           |

> **Lưu ý:** `JWT_SECRET` và `INTERNAL_JWT_SECRET` phải **giống nhau** trên tất cả services. Xem chi tiết tại [ENV_GUIDE.md](../ENV_GUIDE.md).

### Ví dụ `.env` cho local development

```env
# Database — dùng chung 1 DB, mỗi service 1 schema
DATABASE_URL="postgresql://core:corepass@localhost:5433/coredb?schema=auth"

# Redis
REDIS_URL="redis://localhost:6379"

# NATS
NATS_URL="nats://localhost:4222"

# JWT
JWT_SECRET="your-secure-jwt-secret-at-least-32-chars"
JWT_EXPIRES_IN="9000s"
JWT_REFRESH_EXPIRES_IN="604800s"
JWT_ISSUER="auth-service"
JWT_AUDIENCE="api"

# Internal JWT
INTERNAL_JWT_SECRET="your-secure-internal-secret"
INTERNAL_JWT_ISSUER="gateway"
INTERNAL_JWT_AUDIENCE="internal"

# Encryption
ENCRYPT_KEY="your-32-character-encrypt-key!!!"

# Logging
LOG_LEVEL="debug"
```

---

## 4. Generate Prisma Clients

```bash
npm run prisma:generate
```

Hoặc thủ công:

```bash
cd apps/auth-service && npx prisma generate
cd ../notification-service && npx prisma generate
cd ../gateway && npx prisma generate
cd ../..
```

---

## 5. Run Migrations

```bash
# Auth service (schema: auth)
cd apps/auth-service
DATABASE_URL="postgresql://core:corepass@localhost:5433/coredb?schema=auth" npx prisma migrate deploy
cd ../..

# Notification service (schema: notification)
cd apps/notification-service
DATABASE_URL="postgresql://core:corepass@localhost:5433/coredb?schema=notification" npx prisma migrate deploy
cd ../..

# Gateway (schema: gateway)
cd apps/gateway
DATABASE_URL="postgresql://core:corepass@localhost:5433/coredb?schema=gateway" npx prisma migrate deploy
cd ../..
```

---

## 6. Seed Data (Optional)

Tạo dữ liệu mẫu (roles, permissions, users):

```bash
cd apps/auth-service && npx prisma db seed && cd ../..
```

Seed data tạo ra:

| Entity      | Giá trị                                        |
| ----------- | ---------------------------------------------- |
| Permissions | `notifications:read`, `notifications:write`    |
| Roles       | `user` (read), `admin` (read + write)          |
| Users       | `admin@example.com` / `Admin@123` (role admin) |
|             | `user@example.com` / `User@123` (role user)    |

---

## 7. Start Services

Mỗi service chạy trong terminal riêng:

```bash
# Terminal 1 — Auth Service (port 3001)
npm run dev:auth-service

# Terminal 2 — Notification Service (port 3002)
npm run dev:notification-service

# Terminal 3 — Gateway (port 3000)
npm run dev:gateway
```

> **Thứ tự khởi động:** Auth Service → Notification Service → Gateway (gateway phụ thuộc vào 2 services kia).

---

## 8. Verify

```bash
# Health check
curl http://localhost:3000/health

# Login với seed user
curl -X POST http://localhost:3000/client/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "Admin@123"}'
```

NATS monitoring:

```bash
curl http://localhost:8222/jsz
```

---

## Troubleshooting

### `Could not connect to PostgreSQL`

- Kiểm tra Docker container: `docker ps | grep core_postgres`
- Kiểm tra port mapping: `5433:5432`
- Kiểm tra `DATABASE_URL` có đúng schema không (ví dụ `?schema=auth`)

### `NATS connection error`

- Kiểm tra container: `docker ps | grep core_nats`
- Kiểm tra JetStream enabled: `curl http://localhost:8222/jsz`
- Đảm bảo `NATS_URL=nats://localhost:4222`

### `Redis connection error`

- Kiểm tra container: `docker ps | grep core_redis`
- Rate limiter sẽ **fail-open** (cho phép request) khi Redis down

### `Cannot find module '@common/core'`

- Chạy `npm run build:packages` trước khi start services
- Hoặc chạy `npm run build` để build tất cả

### `Prisma: Table does not exist`

- Chạy migrations: `npx prisma migrate deploy`
- Kiểm tra schema đúng trong `DATABASE_URL` (ví dụ `?schema=auth`)

### Lỗi `patch-package`

- File patch nằm tại `patches/@nestjs+cli+11.0.16.patch`
- Nếu lỗi, thử `npm rebuild`

---

## Development Workflow

### Thêm migration mới

```bash
cd apps/auth-service
npx prisma migrate dev --name your_migration_name
```

### Build shared packages sau khi sửa

```bash
npm run build:packages
```

### Lint & Format

```bash
npm run lint
npm run format
```
