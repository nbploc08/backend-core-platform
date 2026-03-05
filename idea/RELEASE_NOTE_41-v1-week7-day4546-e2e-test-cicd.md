# Release Note

- **Release date**: 05/03/2026
- **Scope**: CI/CD GitHub Actions + Environment Configuration + Root README + Build/Test Scripts
- **Device**: Backend API (NestJS) — gateway, auth-service, notification-service
- **Branch**: `41-v1-week7-day4546-e2e-test---cicd`

## Overview

- Thiết lập **CI/CD pipeline** hoàn chỉnh bằng **GitHub Actions** với 2 workflows: **CI** (full pipeline) và **Lint** (fast check cho PRs).
- CI workflow chạy trên **matrix builds** (Node 20.x, 22.x) với đầy đủ **service containers**: PostgreSQL 16, Redis 7, NATS 2.10 (JetStream).
- Bổ sung **root-level scripts** (`build`, `test`, `test:e2e`) cho phép chạy toàn bộ monorepo từ root.
- Tạo **README.md** tại root với CI badges, features list, quick start guide và links tới documentation.
- Rà soát và **bổ sung đầy đủ biến môi trường** cho tất cả `.env.example` files — nhiều biến quan trọng bị thiếu trước đó (`DATABASE_URL`, `NATS_URL`, `REDIS_URL`, `MAIL_USER`, `LOG_LEVEL`, v.v.).

## Changes

### CI/CD — GitHub Actions

- **`.github/workflows/ci.yml`** (NEW)
  - Trigger: push lên `main`/`develop` + pull requests tới `main`/`develop`.
  - **Concurrency control**: cancel in-progress runs cho cùng branch (tránh lãng phí runner).
  - **Matrix builds**: Node 20.x và 22.x.
  - **Service containers**:
    - PostgreSQL 16 với health check (`pg_isready`).
    - Redis 7-alpine với health check (`redis-cli ping`).
    - NATS 2.10 chạy bằng `docker run` (để truyền flag `-js` cho JetStream + `-m 8222` cho monitoring).
  - **Pipeline steps**:
    1. Checkout code (`actions/checkout@v4`).
    2. Setup Node.js với npm cache (`actions/setup-node@v4`).
    3. Start NATS with JetStream (docker run + health check loop).
    4. Create database schemas (`auth`, `notification`, `gateway`) bằng `psql`.
    5. Install dependencies (`npm ci`).
    6. Build shared packages (`packages/contracts` → `packages/common` — đúng thứ tự dependency).
    7. Lint (`npm run lint`).
    8. Run Prisma migrations (`prisma migrate deploy`) cho cả 3 services với `DATABASE_URL` riêng biệt.
    9. Unit tests (cả 3 services, `--passWithNoTests`).
    10. E2E tests (cả 3 services, `--passWithNoTests`).
    11. Build all apps (`nest build` cho cả 3 services).
    12. Cleanup NATS container (`if: always()`).
  - **Environment variables**: đầy đủ cho cả 3 services (JWT, Internal JWT, DB, Redis, NATS, ENCRYPT_KEY).

- **`.github/workflows/lint.yml`** (NEW)
  - Trigger: mọi pull request.
  - Concurrency control: cancel in-progress.
  - Chạy nhanh hơn CI (không cần DB, Redis, NATS).
  - Steps: checkout → setup Node 22.x → `npm ci` → build shared packages → `npm run lint`.

### Root `package.json` — Scripts

- **Thêm mới**:
  - `build:packages` — build `packages/contracts` rồi `packages/common` (đúng thứ tự dependency).
  - `build:apps` — build cả 3 apps (auth-service, gateway, notification-service).
  - `build` — build toàn bộ (`build:packages` → `build:apps`).
  - `test` — chạy unit tests cả 3 services (`--passWithNoTests`).
  - `test:e2e` — chạy E2E tests cả 3 services (`--passWithNoTests`).
- **Sửa**: `test` script cũ là placeholder (`echo "Error: no test specified"`) → thay bằng script thực tế.

### Root `README.md`

- **Tạo mới** với nội dung:
  - CI/Lint badges (GitHub Actions).
  - Features list (JWT, RBAC, WebSocket, NATS, BullMQ, Idempotency, Rate Limiting).
  - Quick Start guide (5 steps).
  - Scripts table (dev, build, test, lint, format).
  - Links tới documentation (`docs/` folder).

### Environment Configuration — `.env.example` files

- **Root `.env.example`**:
  - Thêm `LOG_LEVEL`.
  - Cập nhật comments (thêm gateway schema, mô tả rõ hơn).

- **`apps/auth-service/.env.example`**:
  - Thêm `DATABASE_URL`, `NATS_URL`, `LOG_LEVEL`.
  - Sửa `PORT` từ `3000` → `3001` (khớp với thực tế, tránh conflict với gateway).

- **`apps/gateway/.env.example`**:
  - Thêm `NATS_URL`, `LOG_LEVEL`, `ENCRYPT_KEY`.
  - Sắp xếp lại thứ tự và bổ sung comments.

- **`apps/notification-service/.env.example`**:
  - Thêm `SERVICE_NAME`, `PORT`, `LOG_LEVEL`, `NATS_URL`, `REDIS_URL`, `AUTH_SERVICE_URL`.
  - Thêm `MAIL_USER`, `MAIL_APP_PASSWORD`, `VERIFY_LINK_BASE_URL`.
  - Thêm `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`.
  - Sửa `INTERNAL_JWT_ISSUER` từ `AUTH-SERVICE` → `gateway` (khớp với issuer mà gateway ký).
  - File cũ chỉ có 5 biến → nay có đầy đủ 16 biến.

### Actual `.env` files (không commit, chỉ local)

- Đồng bộ tất cả `.env` files với `.env.example` — bổ sung các biến thiếu.
- Sửa formatting: bỏ khoảng trắng thừa trước `=` trong `MAIL_USER`, `MAIL_APP_PASSWORD`, `NOTIFICATION_SERVICE_URL`.
- Sửa `INTERNAL_JWT_ISSUER` trong notification-service từ `NOTIFICATION-SERVICE` → `gateway`.
- Sửa `INTERNAL_JWT_ISSUER` trong auth-service từ `AUTH-SERVICE` → `gateway`.

## Migration

- **Migration required**: No

## Dependencies

- **Added**: Không thêm package mới.
- **Unchanged**: Tất cả dependency hiện có đủ cho CI/CD.

## Affected files

| File                                     | Status  | Mô tả                                                    |
| ---------------------------------------- | ------- | -------------------------------------------------------- |
| `.github/workflows/ci.yml`               | NEW     | CI pipeline đầy đủ (lint + test + build)                 |
| `.github/workflows/lint.yml`             | NEW     | Fast lint check cho PRs                                  |
| `README.md`                              | NEW     | Root README với badges, features, quick start            |
| `package.json`                           | UPDATED | Thêm `build`, `test`, `test:e2e` scripts                 |
| `.env.example`                           | UPDATED | Thêm `LOG_LEVEL`                                         |
| `apps/auth-service/.env.example`         | UPDATED | Thêm `DATABASE_URL`, `NATS_URL`, `LOG_LEVEL`; sửa `PORT` |
| `apps/gateway/.env.example`              | UPDATED | Thêm `NATS_URL`, `LOG_LEVEL`, `ENCRYPT_KEY`              |
| `apps/notification-service/.env.example` | UPDATED | Bổ sung 11 biến thiếu, sửa `INTERNAL_JWT_ISSUER`         |
| `idea/WEEK7_DAY43-49_PLAN.md`            | UPDATED | Cập nhật trạng thái Day 46                               |

## Notes

- **`package-lock.json`** cần được commit để `npm ci` hoạt động trong CI. Nếu chưa có trong repo, hãy commit file này.
- NATS được start bằng `docker run` thay vì GitHub Actions service container vì service container không hỗ trợ truyền custom command args (`-js` cho JetStream).
- Mỗi service dùng chung 1 PostgreSQL instance (`testdb`) với schemas riêng biệt (`auth`, `notification`, `gateway`), giống production setup.
- CI sử dụng dummy env values (prefix `ci-test-`) — không chứa secrets thực.
