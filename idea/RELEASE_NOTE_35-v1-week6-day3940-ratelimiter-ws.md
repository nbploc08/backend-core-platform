# Release Note

- **Release date**: 02/03/2026
- **Scope**: Gateway — WebSocket refactor (tách module) + Rate Limiter WS
- **Device**: Backend API (NestJS) — gateway
- **Branch**: `35-v1-week6-day3940-ratelimiter-ws`

## Overview

- **Tách WebSocket Gateway** thành `CoreWebsocketGateway` (core, không phụ thuộc business logic) và `NotificationWsGateway` (xử lý notification events). Loại bỏ circular dependency giữa `WebsocketModule` và `NotificationModule`.
- **Rate Limiter cho WS messages**: Giới hạn 10 messages/giây/user, tránh abuse và đảm bảo hệ thống ổn định. Rate limit data được cleanup khi user disconnect (không còn socket nào online).
- **Di chuyển JetStream consumer** từ module `JetstreamModule` (standalone) vào trong `NotificationModule` (`NotificationJetstreamConsumer`), gom logic notification về cùng một nơi.
- **Xóa `JetstreamModule`**: Module này không còn cần thiết sau khi JetStream consumer đã chuyển vào `NotificationModule`.

## Changes

### Gateway

- **`CoreWebsocketGateway` (refactor từ `NotificationWebsocketGateway`)**
  - Đổi tên `NotificationWebsocketGateway` → `CoreWebsocketGateway`.
  - Loại bỏ toàn bộ logic xử lý notification (`notification:read`, `notification:read-all`) ra khỏi gateway core.
  - Loại bỏ dependency vào `NotificationService`, `InternalJwtService` — giờ chỉ còn phụ thuộc `SocketRegistryService` và `ConfigService`.
  - Thêm **rate limiter** (`checkRateLimit(userId)`): in-memory Map, tối đa `MAX_MESSAGES_PER_SECOND = 10` message/giây/user; reset mỗi giây.
  - Cleanup rate limit khi user disconnect: nếu user không còn socket online nào, xóa entry khỏi `rateLimits` Map.
  - Export `SocketData`, `WS_GATEWAY_OPTIONS`, `CoreWebsocketGateway` để các module khác sử dụng.

- **`WebsocketModule` (đơn giản hóa)**
  - Loại bỏ import `NotificationModule`, `InternalJwtModule`.
  - Chỉ còn import `ConfigModule`; providers: `SocketRegistryService`, `CoreWebsocketGateway`.
  - Export `CoreWebsocketGateway`, `SocketRegistryService`.

- **`NotificationWsGateway` (mới)**
  - File: `modules/client/notification-service/notification/events/notification-ws.gateway.ts`.
  - Xử lý `notification:read` và `notification:read-all` (logic tách ra từ `NotificationWebsocketGateway` cũ).
  - Inject `CoreWebsocketGateway` (để gọi `emitToUser`, `checkRateLimit`), `NotificationService`, `InternalJwtService`.
  - Kiểm tra authentication (`socketData.authenticated`) và rate limit trước mỗi handler.
  - Dùng chung `WS_GATEWAY_OPTIONS` với `CoreWebsocketGateway` để chia sẻ cùng Socket.IO server.

- **`NotificationJetstreamConsumer` (di chuyển + rename)**
  - Di chuyển từ `modules/jetstream/jetstream-consumer.service.ts` → `modules/client/notification-service/notification/events/notification-jetstream.consumer.ts`.
  - Đổi tên `JetstreamConsumerService` → `NotificationJetstreamConsumer`.
  - Loại bỏ `@Inject(forwardRef(...))` — inject trực tiếp `CoreWebsocketGateway` (không còn circular dependency).

- **`NotificationModule` (cập nhật)**
  - Import thêm `WebsocketModule`.
  - Providers thêm `NotificationWsGateway`, `NotificationJetstreamConsumer`.

- **Xóa `JetstreamModule`**
  - Xóa file `modules/jetstream/jetstream.module.ts`.
  - Xóa import `JetstreamModule` khỏi `app.module.ts`.

- **`app.module.ts`**
  - Loại bỏ import `JetstreamModule`.

## Architecture

```
Trước (circular dependency):
  WebsocketModule ←→ NotificationModule
  JetstreamModule → WebsocketModule (forwardRef)

Sau (dependency một chiều):
  WebsocketModule (core, không biết notification)
    ↑
  NotificationModule
    ├── NotificationWsGateway     → CoreWebsocketGateway
    └── NotificationJetstreamConsumer → CoreWebsocketGateway
```

## WS Events (không đổi)

| Event Name | Direction | Handler |
|---|---|---|
| `notification:new` | Server → Client | `NotificationJetstreamConsumer` (consume JetStream → emit WS) |
| `notification:read` | Client → Server | `NotificationWsGateway.handleNotificationRead` |
| `notification:read-all` | Client → Server | `NotificationWsGateway.handleNotificationReadAll` |
| `notification:updated` | Server → Client | `NotificationWsGateway` (broadcast sau read/read-all) |
| `ping` / `pong` | Client ↔ Server | `CoreWebsocketGateway.handlePing` |

## Migration

- **Migration required**: No

## Dependencies

- **Added**: Không thêm package mới.
- **Unchanged**: Các dependency hiện có đủ cho refactor.

## Affected Files

**Gateway**

- `apps/gateway/src/app.module.ts`
- `apps/gateway/src/modules/websocket/websocket.gateway.ts` (refactor → `CoreWebsocketGateway`)
- `apps/gateway/src/modules/websocket/websocket.module.ts` (đơn giản hóa)
- `apps/gateway/src/modules/client/notification-service/notification/notification.module.ts`
- `apps/gateway/src/modules/client/notification-service/notification/events/index.ts` (new)
- `apps/gateway/src/modules/client/notification-service/notification/events/notification-ws.gateway.ts` (new)
- `apps/gateway/src/modules/client/notification-service/notification/events/notification-jetstream.consumer.ts` (moved + renamed)
- (Đã xóa: `apps/gateway/src/modules/jetstream/jetstream.module.ts`)
- (Đã xóa: `apps/gateway/src/modules/jetstream/jetstream-consumer.service.ts`)

**Notification Service**

- `apps/notification-service/src/modules/notification/notification.service.ts` (minor formatting)
