# Release Note

- **Release date**: 07/03/2026
- **Scope**: Gateway (chuẩn hóa DTO, response, error handling), Auth Service (chuẩn hóa response, bổ sung requestId vào flow đăng ký)
- **Device**: Backend API (NestJS) — gateway, auth-service
- **Branch**: `47-v1-week8-fix-dto-gateway--service`

## Overview

- Chuẩn hóa toàn bộ response API theo chuẩn `ApiResponse` (success/error) cho cả gateway và auth-service.
- Chuẩn hóa DTO cho các luồng đăng ký, xác thực, và các API liên quan.
- Cải tiến flow đăng ký: truyền `requestId` xuyên suốt từ gateway xuống auth-service, log và event.
- Chuẩn hóa error handling: mọi lỗi đều trả về đúng code/message từ service gốc, không còn mất thông tin lỗi khi qua gateway.
- Refactor, clean up import, gom các response helper về @common/core.

## Changes

### Gateway

- **Chuẩn hóa response**
  - Sử dụng `TransformInterceptor` để mọi response đều theo chuẩn `ApiResponse`.
  - Sử dụng `HttpExceptionFilter` để mọi lỗi đều trả về đúng code/message từ service gốc.
- **Chuẩn hóa DTO**
  - Thêm mới/chuẩn hóa `RegisterDto`, `LoginDto`, các DTO xác thực, quên mật khẩu, v.v.
- **Cải tiến flow đăng ký**
  - Truyền `requestId` từ middleware xuống toàn bộ flow đăng ký, xác thực, refresh, v.v.
  - Tích hợp idempotency cho API đăng ký (dựa vào idempotency-key).
- **Chuẩn hóa error handling**
  - Sửa `handleAxiosError` để parse đúng code/message từ response của auth-service.
  - Đảm bảo mọi lỗi từ auth-service trả về client đều giữ nguyên code/message.
- **Refactor**
  - Gom các helper response, error, interceptor về @common/core.
  - Clean up import, chuẩn hóa lại cấu trúc file.

### Auth Service

- **Chuẩn hóa response**
  - Sử dụng `ApiResponse` cho mọi endpoint (success/error).
  - Sử dụng `HttpExceptionFilter` để mọi lỗi đều trả về đúng code/message.
- **Cải tiến flow đăng ký**
  - Nhận và log `requestId` từ gateway, truyền vào event `user.registered`.
- **Chuẩn hóa error handling**
  - Đảm bảo mọi lỗi nghiệp vụ trả về đúng code/message, không trả generic message.
- **Refactor**
  - Chuẩn hóa lại DTO, gom response helper về @common/core.

## Migration

- **Migration required**: No

## Dependencies

- **Added**: Không thêm package mới.
- **Unchanged**: Các dependency hiện có đủ cho các thay đổi.

## Affected files (tham khảo)

**Gateway**

- `apps/gateway/src/main.ts`
- `apps/gateway/src/modules/client/auth-service/auth/auth-client.controller.ts`
- `apps/gateway/src/modules/client/auth-service/auth/auth-client.service.ts`
- `apps/gateway/src/modules/client/auth-service/auth/dto/register.dto.ts`
- `apps/gateway/src/modules/client/auth-service/auth/dto/login.dto.ts`
- `apps/gateway/src/modules/share/idempotency.service.ts`
- `apps/gateway/src/middlewares/request-id.middleware.ts`
- `apps/gateway/src/modules/internal-jwt/internal-jwt.service.ts`
- `apps/gateway/src/modules/internal-jwt/internal-jwt.module.ts`

**Auth-service**

- `apps/auth-service/src/modules/auth/auth.controller.ts`
- `apps/auth-service/src/modules/auth/auth.service.ts`
- `apps/auth-service/src/modules/auth/dto/register.dto.ts`
- `apps/auth-service/src/modules/auth/dto/verifyRegister.dto.ts`
- `apps/auth-service/src/modules/users/users.service.ts`

**Common**

- `packages/common/src/response/response.ts`
- `packages/common/src/response/transform.interceptor.ts`
- `packages/common/src/errors/http-exception.filter.ts`
- `packages/common/src/errors/error-axios.ts`
- `packages/common/src/errors/service-error.ts`
