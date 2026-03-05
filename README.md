![CI](https://github.com/nbploc08/core-platform/workflows/CI/badge.svg)
![Lint](https://github.com/nbploc08/core-platform/workflows/Lint/badge.svg)

# Backend Core Platform

Monorepo NestJS microservices: Auth, Gateway, Notifications

## Features

- JWT auth with refresh tokens
- RBAC (Role-Based Access Control)
- Real-time WebSocket notifications
- Event-driven architecture (NATS JetStream)
- Async job queue (BullMQ)
- Idempotency framework
- Rate limiting (Redis)
- E2E tested & CI/CD ready

## Quick Start

1. Clone repo
2. `npm install`
3. `docker-compose -f infra/docker-compose.dev.yml up -d`
4. Run migrations (see [docs/SETUP.md](docs/SETUP.md))
5. `npm run dev:gateway`

## Scripts

| Script                             | Description                            |
| ---------------------------------- | -------------------------------------- |
| `npm run dev:gateway`              | Start gateway in dev mode              |
| `npm run dev:auth-service`         | Start auth-service in dev mode         |
| `npm run dev:notification-service` | Start notification-service in dev mode |
| `npm run build`                    | Build all packages & apps              |
| `npm run test`                     | Run unit tests across all services     |
| `npm run test:e2e`                 | Run E2E tests across all services      |
| `npm run lint`                     | Lint entire monorepo                   |
| `npm run format`                   | Format code with Prettier              |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Documentation

- [Setup Guide](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [RBAC & Permissions](docs/RBAC.md)
- [Testing](docs/TESTING.md)
- [Operations](docs/OPERATIONS.md)
