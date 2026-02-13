## Tuần 4 — Day 25–28: Trạng thái & Thiếu sót

**Phạm vi kiểm tra:**

- Code thực tế trong `apps/gateway`, `apps/auth-service`, `apps/notification-service`, `packages/common`.
- Các mô tả trong `idea/DAILY_SCHEDULE_CORE_V1.md` và các file ý tưởng liên quan (RBAC/permission).

---

### Day 25 — Gateway BFF forward `/auth/*` (internal call)

**Mục tiêu trong lịch:**

1. Gateway routes `/auth/*` forward sang auth-service.
2. Mapping errors upstream → error system chuẩn.
3. Propagate `requestId/traceId` headers.

**Hiện trạng (thực tế code):**

- Gateway expose nhóm API auth tại:
  - Controller: `client/auth` (`AuthClientController`).
  - Service: `AuthClientService`.
- Các endpoint chính đã **forward sang auth-service** qua HTTP nội bộ:
  - `GET client/auth/me` → `GET auth/internal/me`.
  - `POST client/auth/login` → `POST auth/internal/login`.
  - `POST client/auth/register` → `POST auth/internal/register`.
  - `POST client/auth/register/verify` → `POST auth/internal/register/verify`.
  - `POST client/auth/resend-code` → `POST auth/internal/resend-code`.
  - `POST client/auth/refresh` → `POST auth/internal/refresh` (kèm cookie refreshToken/deviceId).
  - `POST client/auth/logout-device` → `POST auth/internal/logout-device`.
  - `POST client/auth/logout-all` → `POST auth/internal/logout-all`.
  - Forgot/reset password flows cũng forward tương ứng.
- **Internal call** dùng `InternalJwtService.signInternalToken(...)` → gửi `Authorization: Bearer <internal-jwt>` + header `x-request-id`.
- Lỗi từ auth-service được map về Gateway thông qua `handleAxiosError` + `HttpExceptionFilter` của `@common/core`.

**Kết luận Day 25:** **ĐÃ ĐẠT (DONE)**  
Khác biệt nhỏ so với mô tả là prefix public dùng `client/auth` (BFF style) chứ không phải đúng path `/auth/*`, nhưng về mặt chức năng: client chỉ gọi Gateway, Gateway forward đầy đủ sang auth-service qua internal HTTP + internal JWT + requestId.

---

### Day 26 — Zero-trust internal JWT (service→service)

**Mục tiêu trong lịch:**

1. Define internal JWT issuer/secret.
2. Gateway khi gọi auth/noti internal endpoints gửi `Authorization: Bearer <internal-jwt>`.
3. Auth-service & notification-service middleware verify internal JWT (iss/aud/scope/exp).
4. Reject internal calls thiếu token.

**Hiện trạng:**

- **Gateway:**
  - `InternalJwtService`:
    - Đọc `INTERNAL_JWT_SECRET`, `INTERNAL_JWT_ISSUER`, `INTERNAL_JWT_AUDIENCE` (hoặc default).
    - Ký token với payload `{ sub: 'gateway', data: {...} }`, `expiresIn: '5m'`.
  - `AuthClientService` + `RoleClientService`:
    - Mọi call nội bộ sang auth-service (`auth/internal/*`, `roles/*`) đều gắn `Authorization: Bearer <internal-jwt>` + `x-request-id`.
- **Auth-service:**
  - `InternalJwtStrategy` (`passport-jwt` strategy `'internal-jwt'`):
    - Verify token using `INTERNAL_JWT_SECRET` + `INTERNAL_JWT_AUDIENCE`.
    - Trả `{ caller, data }` cho request user.
  - `InternalJwtAuthGuard` được gắn làm `APP_GUARD` → tất cả route (trừ @Public) yêu cầu internal JWT.
  - Kết quả: gọi trực tiếp endpoint `auth/internal/*` mà **không có Bearer internal JWT** sẽ bị 401 → đúng spirit zero-trust.
- **Notification-service:**
  - Hiện **chưa có** strategy/guard cho internal JWT.
  - `notification.controller.ts` expose route `notification/*` nhưng chưa được bảo vệ bởi internal JWT (và bản thân Day 30–31 mới dùng internal APIs này).

**Kết luận Day 26:** **ĐÃ HOÀN THÀNH CHO auth-service, CHƯA ÁP DỤNG CHO notification-service**

- Đủ điều kiện: Gateway ↔ Auth-service đã zero-trust bằng internal JWT, guard bắt buộc token, reject nếu thiếu.
- Thiếu: áp dụng cùng pattern cho Notification-service (internal JWT strategy + guard, Gateway client noti gửi internal JWT).

**TODO gợi ý:**

- Thêm `InternalJwtStrategy` + guard tương tự auth-service vào `apps/notification-service`.
- Các internal endpoint của notification (list/unread/read/read-all) chỉ chấp nhận call có internal JWT.

---

### Day 27 — Redis cache permVersion/perms (if enabled)

**Mục tiêu trong lịch:**

1. Cache key `permVersion:<userId>` TTL.
2. Cache perms snapshot keyed by userId+permVersion.
3. Invalidate on perm change.

**Hiện trạng:**

- **Redis cache cho permissions đã tồn tại trong `packages/common`:**
  - `PermissionCache` (dùng `ioredis`):
    - Key: `permissions:user:<userId>:` (hash).
    - Trường lưu: `permVersion` (string), `permissions` (JSON array).
    - Hỗ trợ: `set`, `get`, `invalidate`, `updatePermVersion`, `clear`.
  - `PermissionProvider`:
    - `getPermissions(userId, permVersion, requestId, authServiceUrl?)`:
      - B1: Đọc cache bằng `PermissionCache.get(userId)`. Nếu có danh sách permissions (array length > 0) → trả về luôn (cache hit).
      - B2: Nếu cache trống → call Auth-service `GET /roles/users/:userId/permissions` qua HTTP client, có internal JWT + `x-request-id`.
      - B3: Lưu kết quả xuống Redis bằng `PermissionCache.set(userId, permVersion, permissions)`.
    - Có log chi tiết cache hit/miss, error handling khi Auth-service unavailable.
  - `PermissionGuard`:
    - Lấy `userId` + `permVersion` từ `request.user.data` (JWT).
    - Gọi `PermissionProvider.getPermissions(...)` → check `hasPermission` theo các permission yêu cầu.
- **Invalidate khi đổi quyền:**
  - `RolesService.assignRole` / `unassignRole`:
    - Chạy transaction: thêm/xóa `UserRole`, đồng thời `user.permVersion += 1`.
    - Sau transaction, gọi `PermissionCache.updatePermVersion(userId, user.permVersion + 1)` → nếu key tồn tại, set lại `permVersion` mới và xóa permissions (array rỗng) → lần fetch sau sẽ buộc call lại Auth-service để lấy perms mới.

**Điểm khác so với plan:**

- Key hiện tại là `permissions:user:<userId>:` (theo user), **không encode permVersion trong key**, nhưng:
  - `permVersion` được lưu trong hash.
  - Hàm `updatePermVersion` sẽ clear permissions khi permVersion thay đổi → đảm bảo không dùng lại cache cũ sau khi đổi quyền.
- TTL: chưa set TTL cho key như mô tả `permVersion:<userId>` TTL → cache hiện **không tự hết hạn**, chỉ được invalidate thủ công.

**Kết luận Day 27:** **CỐT LÕI ĐÃ CÓ (cache + invalidate khi đổi quyền), CÒN THIẾU TTL & SO SÁNH permVersion RÕ RÀNG**

**TODO gợi ý:**

- Thêm TTL (vd 5–15 phút) cho key Redis trong `PermissionCache.set`.
- Khi đọc cache, có thể kiểm tra `cached.permVersion === permVersion` trước khi dùng; nếu lệch thì coi như miss.

---

### Day 28 — Buffer + docs RBAC

**Mục tiêu trong lịch:**

- README / tài liệu mô tả:
  - Model RBAC (Role, Permission, UserRole, RolePermission, permVersion).
  - Cách thêm quyền mới (permission code mới, gắn vào role, cập nhật gateway).

**Hiện trạng:**

- ĐÃ có một số tài liệu rời rạc:
  - `idea/DAY_22_RBAC_GUIDE.md`: hướng dẫn Day 22 (schema, seed, assign role).
  - `idea/16-v1-week4-day23-permission-guard-and-decorator.md`: mô tả guard/decorator.
  - `packages/common` có `PermissionModule`, `PermissionGuard`, `RequirePermission` decorator.
- Tuy nhiên **chưa có một README/tài liệu tổng hợp** cho:
  - Toàn bộ flow RBAC (user ↔ role ↔ permission ↔ permVersion ↔ cache ↔ gateway guard).
  - Checklist “Thêm permission mới” (các bước từ DB → seed → code → gateway).

**Kết luận Day 28:** **CHƯA HOÀN THÀNH**

- Mới có guide cho từng ngày (Day 22, 23), chưa có tài liệu RBAC end-to-end như mô tả Day 28.

**TODO gợi ý cho Day 28:**

- Tạo thêm 1 file, ví dụ: `idea/RBAC_OVERVIEW_AND_HOW_TO_ADD_PERMISSION.md` gồm:
  - Sơ đồ quan hệ: User ↔ UserRole ↔ Role ↔ RolePermission ↔ Permission.
  - Giải thích `permVersion` (tăng khi đổi quyền, đi trong JWT, liên kết cache).
  - Cách bật PermissionGuard ở Gateway + dùng `@RequirePermission(...)`.
  - Quy trình thêm permission mới (bước cụ thể, có ví dụ `notifications:read` / `notifications:write`).

---

### Tóm tắt nhanh

- **Day 25**: ✅ Đã forward các flow `/auth/*` qua Gateway BFF (`client/auth`), dùng internal JWT + requestId + error mapping chuẩn.
- **Day 26**: ✅ cho Auth-service (internal JWT đầy đủ), ❌ chưa áp dụng cho Notification-service.
- **Day 27**: ✅ Đã có Redis cache perms + invalidation khi đổi quyền; ⚠ thiếu TTL và việc so sánh `permVersion` rõ ràng.
- **Day 28**: ❌ Chưa có tài liệu RBAC tổng hợp; mới có hướng dẫn lẻ cho Day 22/23.
