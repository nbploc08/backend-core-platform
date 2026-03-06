![CI](https://github.com/nbploc08/core-platform/workflows/CI/badge.svg)
![Lint](https://github.com/nbploc08/core-platform/workflows/Lint/badge.svg)

# Backend Core Platform

Production-ready monorepo NestJS microservices platform — a reusable backend "core" for any project. Plug in your business services without rebuilding auth, RBAC, notifications, or realtime infrastructure.

## Architecture Overview

```
Client ──▶ Gateway (3000) ──▶ Auth Service (3001)
               │                    │
               │               PostgreSQL (auth schema)
               │                    │
               ├── WebSocket ◀──── NATS JetStream ◀──── Notification Service (3002)
               │                                              │
               └── Redis (rate limit + permission cache)    BullMQ (email jobs)
```

| Service                  | Port | Responsibility                                           |
| ------------------------ | ---- | -------------------------------------------------------- |
| **Gateway**              | 3000 | API Gateway, BFF proxy, WebSocket server, idempotency    |
| **Auth Service**         | 3001 | Authentication, JWT, RBAC, user management               |
| **Notification Service** | 3002 | In-app notifications, email sending, JetStream consumers |

## Features

- **Authentication** — JWT access tokens (15 min) + refresh tokens (hashed in DB, per-device tracking, rotation)
- **RBAC** — Role-Based Access Control with `@RequirePermission()` decorator, permission versioning, Redis-cached permissions
- **Real-time WebSocket** — Socket.IO with JWT auth, multi-tab support, socket registry, in-memory rate limiting (10 msg/sec/user)
- **Event-driven architecture** — NATS JetStream for `user.registered` and `notification.created` events with contract-first Zod validation
- **Async job queue** — BullMQ for email sending with retry/backoff and Dead Letter Queue (DLQ)
- **Idempotency** — SHA-256 request hashing + DB/in-memory cache for POST registration endpoint
- **Rate limiting** — Redis-based distributed rate limiting with atomic Lua script, `@RateLimit()` decorator, fail-open strategy
- **Internal JWT** — Zero-trust service-to-service auth with separate secret/issuer/audience
- **Structured logging** — Pino JSON logger with request ID propagation and sensitive data redaction
- **Centralized error handling** — `ServiceError` with error codes, `HttpExceptionFilter`, no stack trace leaks in production
- **CI/CD** — GitHub Actions with matrix builds (Node 20.x, 22.x), PostgreSQL/Redis/NATS service containers

## Tech Stack

| Category    | Technology                       |
| ----------- | -------------------------------- |
| Framework   | NestJS (TypeScript)              |
| Database    | PostgreSQL 16 (Prisma ORM)       |
| Cache       | Redis 7                          |
| Message Bus | NATS 2.10 (JetStream)            |
| Job Queue   | BullMQ                           |
| WebSocket   | Socket.IO                        |
| Auth        | Passport.js, JWT, Argon2id       |
| Email       | Nodemailer (Gmail SMTP)          |
| Validation  | Zod (contracts), class-validator |
| Logging     | Pino                             |
| CI/CD       | GitHub Actions                   |

## Quick Start

```bash
# 1. Clone & install
git clone <repo-url> && cd backend-core-platform
npm install

# 2. Start infrastructure
docker compose -f infra/docker-compose.dev.yml up -d

# 3. Configure environment
cp .env.example .env
# Edit .env with your values (see docs/SETUP.md for details)

# 4. Generate Prisma clients & run migrations
npm run prisma:generate
cd apps/auth-service && npx prisma migrate deploy && cd ../..
cd apps/notification-service && npx prisma migrate deploy && cd ../..
cd apps/gateway && npx prisma migrate deploy && cd ../..

# 5. Seed data (optional — creates admin@example.com / Admin@123)
cd apps/auth-service && npx prisma db seed && cd ../..

# 6. Start services (each in a separate terminal)
npm run dev:auth-service
npm run dev:notification-service
npm run dev:gateway
```

## Scripts

| Script                             | Description                              |
| ---------------------------------- | ---------------------------------------- |
| `npm run dev:gateway`              | Start gateway in dev mode                |
| `npm run dev:auth-service`         | Start auth-service in dev mode           |
| `npm run dev:notification-service` | Start notification-service in dev mode   |
| `npm run build`                    | Build all packages & apps                |
| `npm run build:packages`           | Build shared packages only               |
| `npm run build:apps`               | Build all apps only                      |
| `npm run test`                     | Run unit tests across all services       |
| `npm run test:e2e`                 | Run E2E tests across all services        |
| `npm run test:ws-load`             | Run WebSocket load test                  |
| `npm run lint`                     | Lint entire monorepo                     |
| `npm run format`                   | Format code with Prettier                |
| `npm run prisma:generate`          | Generate Prisma clients for all services |

## Project Structure

```
backend-core-platform/
├── apps/
│   ├── gateway/              # API Gateway + WebSocket (port 3000)
│   ├── auth-service/         # Auth + RBAC (port 3001)
│   └── notification-service/ # Notifications + Email (port 3002)
├── packages/
│   ├── common/               # Shared: logger, errors, guards, decorators, NATS, rate limiter
│   └── contracts/            # Shared: event schemas, WS contracts (Zod-validated)
├── infra/
│   └── docker-compose.dev.yml
├── .github/workflows/        # CI/CD (ci.yml, lint.yml)
├── idea/                     # Internal planning & release notes
└── docs/                     # User-facing documentation
```

## Documentation

| Document                             | Description                          |
| ------------------------------------ | ------------------------------------ |
| [Setup Guide](docs/SETUP.md)         | Prerequisites, installation, config  |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flows, schemas   |
| [Security](docs/SECURITY.md)         | Auth, RBAC, rate limiting, headers   |
| [RBAC & Permissions](docs/RBAC.md)   | How RBAC works, adding permissions   |
| [Testing](docs/TESTING.md)           | Testing strategy, running tests      |
| [Operations](docs/OPERATIONS.md)     | Logging, errors, health checks, jobs |
| [Environment Guide](ENV_GUIDE.md)    | All environment variables            |

## API Endpoints

### Auth (`/client/auth`)

| Method | Route                                  | Auth   | Rate Limit                        |
| ------ | -------------------------------------- | ------ | --------------------------------- |
| POST   | `/client/auth/register`                | Public | 5/min per IP + idempotency        |
| POST   | `/client/auth/register/verify`         | Public | —                                 |
| POST   | `/client/auth/register/verify/confirm` | Public | —                                 |
| POST   | `/client/auth/resend-code`             | Public | 5/min per IP, 2/min per email     |
| POST   | `/client/auth/login`                   | Public | 10/min per IP, 5/min per email    |
| POST   | `/client/auth/refresh`                 | Public | 20/min per IP                     |
| GET    | `/client/auth/me`                      | JWT    | —                                 |
| POST   | `/client/auth/logout-device`           | JWT    | —                                 |
| POST   | `/client/auth/logout-all`              | JWT    | —                                 |
| POST   | `/client/auth/forgot/password`         | Public | 5/10min per IP, 2/10min per email |
| POST   | `/client/auth/forgot/password/verify`  | Public | 10/10min per IP                   |
| POST   | `/client/auth/forgot/password/reset`   | Public | 5/10min per IP                    |

### Roles (`/client/roles`)

| Method | Route                                     | Rate Limit        |
| ------ | ----------------------------------------- | ----------------- |
| POST   | `/client/roles`                           | 10/min per userId |
| GET    | `/client/roles`                           | 60/min per userId |
| GET    | `/client/roles/:id`                       | 60/min per userId |
| PATCH  | `/client/roles/:id`                       | 60/min per userId |
| DELETE | `/client/roles/:id`                       | 60/min per userId |
| GET    | `/client/roles/users/:userId/roles`       | 60/min per userId |
| GET    | `/client/roles/users/:userId/permissions` | 60/min per userId |
| POST   | `/client/roles/assign-role`               | 10/min per userId |
| POST   | `/client/roles/unassign-role`             | 10/min per userId |

### Notifications (`/client/notification`)

| Method | Route                               | Rate Limit        |
| ------ | ----------------------------------- | ----------------- |
| GET    | `/client/notification/healthz`      | Public            |
| POST   | `/client/notification`              | 10/min per userId |
| GET    | `/client/notification`              | 60/min per userId |
| GET    | `/client/notification/unread-count` | 60/min per userId |
| POST   | `/client/notification/:id/read`     | 30/min per userId |
| POST   | `/client/notification/read-all`     | 10/min per userId |

### WebSocket Events

| Direction       | Event                   | Description                                 |
| --------------- | ----------------------- | ------------------------------------------- |
| Server → Client | `authenticated`         | Connection authenticated successfully       |
| Server → Client | `error`                 | Auth/rate-limit failure                     |
| Server → Client | `pong`                  | Response to ping (with timestamp)           |
| Server → Client | `notification:new`      | New notification created                    |
| Server → Client | `notification:updated`  | Notification read/read-all (multi-tab sync) |
| Client → Server | `ping`                  | Latency check                               |
| Client → Server | `notification:read`     | Mark notification as read                   |
| Client → Server | `notification:read-all` | Mark all notifications as read              |

## License

ISC
