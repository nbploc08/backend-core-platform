# Ghi chú Phát hành

**Ngày Phát hành:** 08/02/2026

**Nhánh:** `18-v1-week4-day26-day27`

**Phạm vi:** Backend API (Gateway Service, Notification Service)

---

## Tổng quan

Bản phát hành này thực hiện tái cấu trúc quan trọng trong cơ chế giao tiếp và xác thực giữa **API Gateway** và các **Microservices**. Thay vì Gateway luôn đóng vai trò là một "trusted caller" tự ký Internal JWT cho mọi yêu cầu, Gateway nay sẽ chuyển tiếp (forward) token gốc của người dùng (User JWT) xuống các dịch vụ phía dưới.

Điều này cho phép các Microservices (như Notification Service, Auth Service) trực tiếp xác thực danh tính người dùng và kiểm tra quyền hạn (Permissions) dựa trên token gốc, tuân thủ mô hình **Zero Trust**.

---

## Các Thay đổi

### 1. Gateway Service

**Cơ chế Forward User JWT:**
- Gateway được nâng cấp để xử lý thông minh header `Authorization`:
  - **Authenticated Request:** Nếu request có User Token, Gateway sẽ forward nguyên vẹn (`Bearer <token>`) xuống dịch vụ đích.
  - **Public/System Request:** Nếu không có User Token (ví dụ: login, register), Gateway sẽ tự động ký một **Internal JWT** để xác thực danh tính Gateway với dịch vụ đích.

**Cập nhật Modules:**
- **Auth Client:**
  - `AuthClientService`: Cập nhật logic `getHeaders` để ưu tiên sử dụng token được truyền vào. Nếu không có, mới thực hiện ký Internal JWT.
  - `AuthClientController`: Các endpoint `/me`, `/logout-device`, `/logout-all` chuyển tiếp token từ request của client.
- **Role Client:**
  - Toàn bộ các API quản lý Role (`create`, `findAll`, `assign`, ...) nay chuyển tiếp User Token để Auth Service có thể kiểm tra quyền `rbac.*` chính xác.
- **Notification Client:**
  - Bổ sung toàn bộ các endpoint CRUD (`create`, `findAll`, `findOne`, `update`, `remove`) proxy tới Notification Service.
  - Endpoint `/healthz` vẫn sử dụng Internal JWT.

### 2. Notification Service

**Hỗ trợ Đa Chiến lược Xác thực (Combined Strategy):**
- **JwtModule Refactor:** Tạo mới module `jwt` thay thế cho cấu hình `internal` cũ.
- **CombinedJwtStrategy:** Chiến lược xác thực mới có khả năng xử lý cả hai loại token:
  - **User JWT:** Verify bằng `JWT_SECRET` (audience: `api`). Dùng cho request từ người dùng.
  - **Internal JWT:** Verify bằng `INTERNAL_JWT_SECRET` (audience: `internal`). Dùng cho request từ hệ thống/gateway.
- **Guard:** `CombinedJwtAuthGuard` được cấu hình làm Global Guard (`APP_GUARD`), đảm bảo mọi endpoint đều được bảo vệ nhưng linh hoạt nguồn gọi.

---

## Các Tệp Được Sửa đổi

| Ứng dụng | Đường dẫn Tệp | Mô tả |
|----------|---------------|-------|
| **Gateway** | `apps/gateway/src/modules/client/auth-service/auth/auth-client.service.ts` | Logic dual-token (forward hoặc sign) trong `getHeaders` |
| | `apps/gateway/src/modules/client/auth-service/auth/auth-client.controller.ts` | Lấy header Authorization truyền xuống service |
| | `apps/gateway/src/modules/client/auth-service/role/*` | Cập nhật controller/service để forward token |
| | `apps/gateway/src/modules/client/notification-service/notification/*` | Thêm CRUD endpoints và logic forward token |
| **Notification** | `apps/notification-service/src/modules/jwt/jwt.module.ts` | Module JWT mới (copy cấu trúc từ Auth Service) |
| | `apps/notification-service/src/modules/jwt/strategy/jwt.strategy.ts` | `CombinedJwtStrategy` xử lý User & Internal JWT |
| | `apps/notification-service/src/app.module.ts` | Sử dụng `CombinedJwtAuthGuard` |

---

## Quy trình Xác thực (Flow)

**Trường hợp 1: Người dùng gọi API cần xác thực (ví dụ: Tạo thông báo)**
1. **Client** gửi `POST /client/notification` với header `Authorization: Bearer <user_jwt>`.
2. **Gateway** xác thực token (sơ bộ) tại tầng Gateway (tùy chọn).
3. **Gateway** chuyển tiếp request tới `Notification Service` với header `Authorization: Bearer <user_jwt>` giữ nguyên.
4. **Notification Service** nhận request:
   - `CombinedJwtAuthGuard` đọc token.
   - Phát hiện `aud: 'api'` -> Sử dụng `JWT_SECRET` để verify.
   - Trả về context user (`userId`, `permissions`...).
5. **Notification Service** thực hiện logic nghiệp vụ với danh tính người dùng thực.

**Trường hợp 2: Public API hoặc System Call (ví dụ: Đăng ký, Health Check)**
1. **Client** gửi request không có token hoặc Gateway tự kích hoạt job.
2. **Gateway** phát hiện không có token đầu vào.
3. **Gateway** ký một `Internal JWT` (sub: `gateway`, aud: `internal`).
4. **Gateway** gửi request tới Service với `Authorization: Bearer <internal_jwt>`.
5. **Service** nhận request:
   - Phát hiện `aud: 'internal'` -> Sử dụng `INTERNAL_JWT_SECRET` để verify.
   - Chấp nhận request với quyền hệ thống.

---

## Triển khai & Cấu hình

**Biến Môi trường (.env):**
Để Notification Service có thể verify User JWT, cần cập nhật file `.env` cho service này:

```env
# Thêm vào cấu hình của Notification Service
JWT_SECRET=your_jwt_secret_key_here
JWT_ISSUER=auth-service
JWT_AUDIENCE=api
```

**Lưu ý Migration:**
- Không có thay đổi về Database Schema.
- Cần restart Notification Service và Gateway để áp dụng code mới.

---


