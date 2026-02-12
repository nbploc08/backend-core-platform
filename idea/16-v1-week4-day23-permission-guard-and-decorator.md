# Release Note

- **Release date**: 12/02/2026
- **Scope**: Auth Service (permission guard) + Shared packages (common)
- **Device**: Backend API (NestJS) — auth-service, packages/common
- **Branch**: `16-v1-week4-day23-permission-guard-and-decorator`

## Overview

- Thêm **Permission Guard + Decorator** để kiểm tra quyền theo RBAC dựa trên permission codes.
- **PermissionModule** (common) cung cấp cache Redis + provider gọi Auth Service lấy permission với **Internal JWT**.
- Auth-service bật **PermissionGuard** dạng global và áp dụng `@RequirePermission(...)` cho role management.

## Changes

### Packages (common)

- **Permission decorator**: `@RequirePermission(...PermissionCode[])` gắn metadata `required_permissions`.
- **Permission guard**: bỏ qua route `@Public()`, đọc `required_permissions`, lấy `userId` + `permVersion` từ `request.user.data`, gọi provider để lấy quyền, throw `ForbiddenException` khi thiếu quyền.
- **Permission provider**:
  - Gọi Auth Service `/roles/users/:userId/permissions` với Internal JWT.
  - Cache theo userId trong Redis, kèm permVersion, có invalidate/update.
  - Xử lý lỗi mạng/HTTP và log chi tiết cho debug.
- **Permission module**: global module export `PermissionCache`, `PermissionProvider`, `PermissionGuard`, và HTTP client (axios).
- **Permission enums**: `PermissionCode` là nguồn chuẩn cho permission codes.

### Auth Service

- **Global guard**: `PermissionGuard` được đăng ký ở `APP_GUARD` cùng `InternalJwtAuthGuard`.
- **Roles controller**: endpoint `POST /roles` yêu cầu `PermissionCode.ADMIN_MANAGE_ROLES` bằng `@RequirePermission(...)`.

## Backend API — Các endpoint liên quan

| Service      | Method | Path                          | Mô tả                                                         |
| ------------ | ------ | ----------------------------- | ------------------------------------------------------------- |
| Auth-service | GET    | /roles/users/:userId/permissions | Trả danh sách permission codes của user (dùng cho guard).     |
| Auth-service | POST   | /roles                          | Tạo role, yêu cầu quyền `admin:manage-roles`.                 |

## Migration

- **Migration required**: No

## Dependencies

- **Added**: Không ghi nhận dependency mới trong các file đã đọc.

## Affected files (tham khảo)

```
apps/auth-service/
  src/app.module.ts
  src/modules/roles/roles.controller.ts

packages/common/
  src/decorators/require-permission.decorator.ts
  src/permission/permission.guard.ts
  src/permission/permission.provider.ts
  src/permission/permission.cache.ts
  src/permission/permission.enum.ts
  src/permission/permission.module.ts
  src/index.ts
```
