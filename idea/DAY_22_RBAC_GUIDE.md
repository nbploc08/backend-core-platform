# Day 22 — RBAC tables + seed roles/perms (Hướng dẫn)

**Mục tiêu:** Prisma có bảng Role, Permission, RolePermission, UserRole; seed permissions `notifications:read`, `notifications:write` và roles `admin`/`user`; **Done:** assign role works.

---

## 1. Đã thêm vào repo

### 1.1 Prisma schema (`apps/auth-service/prisma/schema.prisma`)

- **Role**: `id`, `name` (unique), `description`
- **Permission**: `id`, `code` (unique), `description`
- **RolePermission**: N-N giữa Role và Permission (`roleId`, `permissionId`)
- **UserRole**: user–role (`userId`, `roleId`, `assignedAt`)
- **User**: thêm relation `userRoles UserRole[]`

### 1.2 Seed (`apps/auth-service/prisma/seed.ts`)

- Permissions: `notifications:read`, `notifications:write`
- Roles: `user` (chỉ read), `admin` (read + write)
- RolePermission: gắn đúng quyền cho từng role

### 1.3 Service & endpoint

- **RolesService** (`src/modules/roles/roles.service.ts`):
  - `assignRole(userId, roleName)` — gán role cho user
  - `unassignRole(userId, roleName)`
  - `getPermissionCodesForUser(userId)` — dùng cho Day 23 guard
  - `getRolesForUser(userId)`
- **POST** `auth/internal/assign-role`: body `{ "userId": "uuid", "roleName": "user" | "admin" }` (internal JWT bắt buộc)

---

## 2. Các bước bạn cần chạy

### Bước 1: Bật infra (Postgres, Redis, NATS)

```bash
# từ root repo
cd infra
docker compose -f docker-compose.dev.yml up -d
```

Đảm bảo `apps/auth-service/.env` có `DATABASE_URL` đúng (schema `auth`).

### Bước 2: Tạo migration và generate client

```bash
cd apps/auth-service
npx prisma migrate dev --name add_rbac_tables
npx prisma generate
```

Sau khi chạy xong, Prisma Client sẽ có `prisma.role`, `prisma.permission`, `prisma.userRole`, `prisma.rolePermission` → hết lỗi TypeScript/lint ở `roles.service.ts`.

### Bước 3: Chạy seed

```bash
npx prisma db seed
# hoặc
npm run prisma:seed
```

Kết quả: bảng `permissions` có 2 dòng, `roles` có 2 dòng, `role_permissions` có 3 dòng (user→read, admin→read, admin→write).

### Bước 4: Kiểm tra “assign role works”

1. **Qua API (cần internal JWT):**  
   Gateway hoặc tool gọi auth-service với header internal JWT:

   ```http
   POST /auth/internal/assign-role
   Content-Type: application/json
   Authorization: Bearer <internal-jwt>

   { "userId": "<user-uuid>", "roleName": "user" }
   ```

   Trả về: `{ "userId": "...", "roleName": "user" }`.

2. **Qua code/script:**  
   Trong app (ví dụ sau khi register), gọi:

   ```ts
   await this.rolesService.assignRole(newUser.id, 'user');
   ```

3. **Kiểm tra DB:**
   ```sql
   SELECT * FROM auth.user_roles WHERE "userId" = '<user-uuid>';
   ```

---

## 3. Gợi ý: Gán role mặc định khi register

Để mỗi user mới có role `user`, trong `AuthService.register()` sau khi tạo user:

```ts
// auth.service.ts - sau prisma.user.create(...)
await this.rolesService.assignRole(user.id, 'user');
```

Nhớ inject `RolesService` vào `AuthService` và import `RolesModule` vào `AuthModule` (đã có nếu bạn dùng đúng cấu trúc trên).

---

## 4. Checklist Day 22

- [ ] Migration chạy xong, bảng `roles`, `permissions`, `role_permissions`, `user_roles` tồn tại trong schema `auth`
- [ ] Seed chạy xong: 2 permissions, 2 roles, 3 role_permissions
- [ ] `npx prisma generate` đã chạy, không còn lỗi type ở RolesService
- [ ] Gọi assign-role (qua internal endpoint hoặc service) và kiểm tra `user_roles` có bản ghi tương ứng

**Done:** assign role works → sẵn sàng Day 23 (Permission guard + decorator `@RequirePermissions()`).
