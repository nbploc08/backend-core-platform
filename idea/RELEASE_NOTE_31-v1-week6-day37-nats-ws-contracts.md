# Release Note

- **Release date**: 28/02/2026
- **Scope**: Unified NATS Module + WS Contracts + JetStream Consumer Refactor + Prisma Client Isolation
- **Device**: Backend API (NestJS) — gateway, auth-service, notification-service, packages/common, packages/contracts
- **Branch**: `31-v1-week6-day37`

## Overview

- **Unified NATS Module** (`@common/core`): Gộp chức năng publish/consume JetStream và Plain NATS vào một module dùng chung cho tất cả services.
- **BaseJetstreamConsumer**: Abstract class chuẩn hóa việc consume JetStream events, giảm boilerplate code.
- **WS Contract Schemas** (`@contracts/core`): Định nghĩa type-safe schemas cho tất cả WebSocket events bằng Zod.
- **Gateway JetStream Consumer**: Consume `notification.created` event và push real-time đến user qua WebSocket.
- **Prisma Client Isolation**: Mỗi service generate Prisma Client vào thư mục riêng, tránh conflict types trong monorepo.

## Changes

### packages/common (`@common/core`)

- **NatsModule** (Dynamic Module)
  - `NatsModule.forRoot(options)`: Config `serviceName`, `url`, `streams` (name + subjects).
  - Global module, tự động tạo stream nếu chưa tồn tại.

- **NatsService**
  - `publish(subject, data)`: Publish JetStream message (durable, guaranteed delivery).
  - `publishPlain(subject, data)`: Publish Plain NATS message (fire-and-forget).
  - `subscribePlain(subject, handler)`: Subscribe Plain NATS (fire-and-forget consumer).
  - `getJetStream()`, `getJetStreamManager()`, `getConnection()`: Access NATS internals.

- **BaseJetstreamConsumer** (Abstract Class)
  - Implements `OnModuleInit`, `OnModuleDestroy`.
  - `getConsumers(): ConsumerConfig[]`: Abstract method để khai báo consumers.
  - Tự động tạo durable consumer, xử lý ack/nak, retry logic.

- **Exports mới**
  - `NatsModule`, `NatsService`, `NatsModuleOptions`, `NatsStreamConfig`, `ConsumerConfig`, `BaseJetstreamConsumer`.

### packages/contracts (`@contracts/core`)

- **NATS Event Schemas** (cập nhật)
  - `NotificationCreatedSchema`: Thêm `unreadCount` field.

- **WS Contract Schemas** (mới)
  
  | File | Event | Direction | Mô tả |
  |------|-------|-----------|-------|
  | `notification-new.ws.ts` | `notification:new` | Server → Client | Push notification mới với `unreadCount` |
  | `notification-read.ws.ts` | `notification:read` | Client → Server | Đánh dấu 1 notification đã đọc |
  | `notification-read-all.ws.ts` | `notification:read-all` | Client → Server | Đánh dấu tất cả đã đọc |
  | `notification-updated.ws.ts` | `notification:updated` | Server → Client | Phản hồi sau action read |
  | `unread-count-updated.ws.ts` | `unreadCount:updated` | Server → Client | Cập nhật số unread |

### Gateway

- **JetstreamModule** + **JetstreamConsumerService**
  - Consume `NOTIFICATION_EVENT` stream, filter `notification.created`.
  - Parse payload bằng `NotificationCreatedSchema` (Zod).
  - Emit `notification:new` event đến user's sockets qua `NotificationWebsocketGateway.emitToUser()`.
  - Payload type-safe: `NotificationNewPayload` (từ WS contract).

- **NatsModule config**
  - `streams: [{ name: 'NOTIFICATION_EVENT', subjects: ['notification.*'] }]`

- **WebSocket Gateway** (cập nhật)
  - Thêm handlers cho `notification:read` và `notification:read-all` với Zod validation.
  - Import WS contract constants: `WS_NOTIFICATION_READ`, `WS_NOTIFICATION_READ_ALL`.

### Auth Service

- **NatsModule migration**
  - Chuyển từ local `NatsModule` sang `@common/core`.
  - Config: `streams: [{ name: 'AUTH_EVENT', subjects: ['user.*'] }]`

- **Prisma Client**
  - Output: `../node_modules/.prisma/auth-client`
  - Import: `import { PrismaClient } from '.prisma/auth-client'`

### Notification Service

- **JetstreamConsumerService** (refactor)
  - Extends `BaseJetstreamConsumer` từ `@common/core`.
  - Chỉ cần implement `getConsumers()` với logic cụ thể.
  - Giảm từ ~145 lines xuống ~37 lines.

- **NatsModule config**
  - `streams: [{ name: 'AUTH_EVENT', subjects: ['user.*'] }, { name: 'NOTIFICATION_EVENT', subjects: ['notification.*'] }]`

- **NotificationService.createNoti**
  - Publish `notification.created` event với `unreadCount`.

- **Prisma Client**
  - Output: `../node_modules/.prisma/notification-client`
  - Import: `import { PrismaClient } from '.prisma/notification-client'`

### Prisma Schema Changes (all services)

- **auth-service/prisma/schema.prisma**
  ```prisma
  generator client {
    provider = "prisma-client-js"
    output   = "../node_modules/.prisma/auth-client"
  }
  ```

- **notification-service/prisma/schema.prisma**
  ```prisma
  generator client {
    provider = "prisma-client-js"
    output   = "../node_modules/.prisma/notification-client"
  }
  ```

- **gateway/prisma/schema.prisma**
  ```prisma
  generator client {
    provider = "prisma-client-js"
    output   = "../node_modules/.prisma/gateway-client"
  }
  ```

## Event Flow

```
[User Action] 
    → Auth Service publishes `user.registered` to AUTH_EVENT
    → Notification Service consumes `user.registered`
    → Notification Service creates notification record
    → Notification Service publishes `notification.created` to NOTIFICATION_EVENT
    → Gateway consumes `notification.created`
    → Gateway emits `notification:new` via WebSocket to user
```

## API / WS Events

| Type | Event Name | Direction | Payload |
|------|------------|-----------|---------|
| WS | `notification:new` | Server → Client | `{ notificationId, userId, type, title, body?, createdAt, unreadCount }` |
| WS | `notification:read` | Client → Server | `{ notificationId }` |
| WS | `notification:read-all` | Client → Server | `{}` |
| WS | `notification:updated` | Server → Client | `{ action, notificationId?, unreadCount }` |
| WS | `unreadCount:updated` | Server → Client | `{ count }` |
| NATS | `notification.created` | Internal | `{ notificationId, userId, type, title, body?, data?, actionCreatedAt, unreadCount }` |

## Migration

- **Migration required**: No
- **Prisma generate**: Yes — cần chạy `npx prisma generate` cho mỗi service sau khi pull code.

```bash
# Chạy cho từng service
cd apps/auth-service && npx prisma generate
cd apps/notification-service && npx prisma generate
cd apps/gateway && npx prisma generate
```

## Dependencies

- **Added to `@common/core`**: `nats` (peer dependency)
- **Unchanged**: Không thêm package mới vào các apps.

## Affected Files

**packages/common**
- `packages/common/src/index.ts`
- `packages/common/src/nats/nats.module.ts` (new)
- `packages/common/src/nats/nats.service.ts` (new)
- `packages/common/src/nats/nats.interfaces.ts` (new)
- `packages/common/src/nats/nats.constants.ts` (new)
- `packages/common/src/nats/base-jetstream-consumer.ts` (new)
- `packages/common/package.json`

**packages/contracts**
- `packages/contracts/src/index.ts`
- `packages/contracts/src/events/notification.events.ts`
- `packages/contracts/src/ws/index.ts` (new)
- `packages/contracts/src/ws/notification-new.ws.ts` (new)
- `packages/contracts/src/ws/notification-read.ws.ts` (new)
- `packages/contracts/src/ws/notification-read-all.ws.ts` (new)
- `packages/contracts/src/ws/notification-updated.ws.ts` (new)
- `packages/contracts/src/ws/unread-count-updated.ws.ts` (new)

**Gateway**
- `apps/gateway/src/app.module.ts`
- `apps/gateway/src/modules/jetstream/jetstream.module.ts` (new)
- `apps/gateway/src/modules/jetstream/jetstream-consumer.service.ts` (new)
- `apps/gateway/src/modules/websocket/websocket.gateway.ts`
- `apps/gateway/src/modules/prisma/prisma.service.ts`
- `apps/gateway/prisma/schema.prisma`

**Auth Service**
- `apps/auth-service/src/app.module.ts`
- `apps/auth-service/src/modules/auth/auth.service.ts`
- `apps/auth-service/src/modules/prisma/prisma.service.ts`
- `apps/auth-service/prisma/schema.prisma`
- `apps/auth-service/prisma/seed.ts`
- `apps/auth-service/prisma/seed/role.seed.ts`
- `apps/auth-service/prisma/seed/user.seed.ts`
- `apps/auth-service/src/modules/nats/nats.module.ts` (deprecated, replaced by @common/core)
- `apps/auth-service/src/modules/nats/nats.service.ts` (deprecated, replaced by @common/core)

**Notification Service**
- `apps/notification-service/src/app.module.ts`
- `apps/notification-service/src/modules/jetstream/jetstream-consumer.service.ts`
- `apps/notification-service/src/modules/notification/notification.service.ts`
- `apps/notification-service/src/modules/prisma/prisma.service.ts`
- `apps/notification-service/src/modules/mails/mails.service.ts`
- `apps/notification-service/prisma/schema.prisma`
- `apps/notification-service/src/modules/nats/nats.module.ts` (deprecated, replaced by @common/core)
- `apps/notification-service/src/modules/nats/nats.service.ts` (deprecated, replaced by @common/core)

## Usage Examples

### Sử dụng NatsService trong service

```typescript
import { NatsService } from '@common/core';

@Injectable()
export class MyService {
  constructor(private readonly natsService: NatsService) {}

  // JetStream publish (durable)
  async publishEvent() {
    await this.natsService.publish('user.created', { userId: '123' });
  }

  // Plain NATS publish (fire-and-forget)
  sendPlain() {
    this.natsService.publishPlain('metrics.collected', { cpu: 80 });
  }

  // Plain NATS subscribe
  onModuleInit() {
    this.natsService.subscribePlain('metrics.collected', (data) => {
      console.log('Received:', data);
    });
  }
}
```

### Tạo JetStream Consumer

```typescript
import { BaseJetstreamConsumer, ConsumerConfig, NatsService } from '@common/core';

@Injectable()
export class MyConsumerService extends BaseJetstreamConsumer {
  constructor(natsService: NatsService) {
    super(natsService);
  }

  protected getConsumers(): ConsumerConfig[] {
    return [
      {
        streamName: 'MY_STREAM',
        durableName: 'my-consumer',
        filterSubject: 'my.subject',
        handle: async (msg) => {
          const data = JSON.parse(msg.string());
          // Process data...
        },
      },
    ];
  }
}
```

### Type-safe WS Events

```typescript
import { WS_NOTIFICATION_NEW, NotificationNewPayload } from '@contracts/core';

// Server emit
const payload: NotificationNewPayload = {
  notificationId: 'uuid',
  userId: 'uuid',
  type: 'welcome',
  title: 'Welcome!',
  createdAt: new Date().toISOString(),
  unreadCount: 5,
};
this.wsGateway.emitToUser(userId, WS_NOTIFICATION_NEW, payload);

// Client listen
socket.on('notification:new', (data: NotificationNewPayload) => {
  console.log('New notification:', data.title, 'Unread:', data.unreadCount);
});
```
