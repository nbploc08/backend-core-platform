# PROJECT_TREE — Cây thư mục dự án Core Platform v1

> Core Platform v1: Auth + Gateway + Notification (+ Notification Worker)
> 
> Stack: NestJS + TS, npm workspaces, Postgres (1 instance tách schema), Prisma, NATS JetStream, Redis (rate limit + BullMQ), WS realtime bell notifications.

```
saas-core-platform/
├─ apps/
│  ├─ gateway/
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ http/                 # REST controllers
│  │  │  ├─ ws/                   # WebSocket gateway (bell realtime)
│  │  │  ├─ middlewares/          # requestId, auth, etc.
│  │  │  ├─ guards/               # jwt guard, permission guard
│  │  │  ├─ interceptors/
│  │  │  └─ clients/              # internal clients: auth/noti + internal JWT
│  │  ├─ test/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ auth-service/
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  └─ migrations/
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ auth/                 # register/login/refresh/logout
│  │  │  ├─ users/
│  │  │  ├─ rbac/                 # roles/permissions
│  │  │  ├─ sessions/
│  │  │  ├─ password-reset/
│  │  │  ├─ audit/
│  │  │  ├─ nats/                 # publish user.registered etc.
│  │  │  └─ internal/             # internal endpoints verify internal JWT
│  │  ├─ test/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ notification-service/
│  │  ├─ prisma/
│  │  │  ├─ schema.prisma
│  │  │  └─ migrations/
│  │  ├─ src/
│  │  │  ├─ main.ts
│  │  │  ├─ app.module.ts
│  │  │  ├─ notifications/        # list/unread/read/read-all
│  │  │  ├─ consumers/            # NATS JetStream consume user.registered
│  │  │  ├─ publishers/           # publish notification.created
│  │  │  ├─ jobs/                 # enqueue email jobs
│  │  │  └─ internal/             # internal endpoints verify internal JWT
│  │  ├─ test/
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  └─ notification-worker/         # (khuyên tách riêng) BullMQ worker gửi email
│     ├─ src/
│     │  ├─ main.ts
│     │  ├─ worker.ts
│     │  └─ mailer/
│     ├─ package.json
│     └─ tsconfig.json
│
├─ packages/
│  ├─ common/
│  │  ├─ src/
│  │  │  ├─ logging/              # JSON logger (pino)
│  │  │  ├─ errors/               # ErrorCodes, ServiceError, filters
│  │  │  ├─ http/                 # response helpers
│  │  │  ├─ security/             # internal JWT utils, hashing helpers
│  │  │  └─ index.ts
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  └─ contracts/
│     ├─ src/
│     │  ├─ events/               # contract-first events + Zod schemas
│     │  │  ├─ user.events.ts
│     │  │  ├─ notification.events.ts
│     │  │  └─ ws.events.ts       # WS payload contracts (tuần 6)
│     │  ├─ errors/               # error codes/types contract (optional)
│     │  ├─ types/                # jwt claims, permission types
│     │  └─ index.ts
│     ├─ package.json
│     └─ tsconfig.json
│
├─ infra/
│  ├─ docker-compose.dev.yml       # postgres + redis + nats jetstream
│  ├─ docker-compose.prod.yml
│  ├─ sql/
│  │  └─ init.sql                  # create schema auth/notification
│  └─ reverse-proxy/               # caddy/nginx configs (tuần 8)
│
├─ docs/
│  ├─ architecture.md
│  ├─ security.md
│  └─ runbook.md
│
├─ .env.example
├─ package.json                    # root workspace
├─ README.md
└─ tsconfig.base.json
```
