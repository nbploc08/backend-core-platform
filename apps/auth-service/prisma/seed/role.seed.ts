import type { PrismaClient } from '@prisma/client';

export async function runRoleSeed(prisma: PrismaClient) {
  // 1. Permissions
  const permRead = await prisma.permission.upsert({
    where: { code: 'notifications:read' },
    update: {},
    create: {
      code: 'notifications:read',
      description: 'Xem danh sách thông báo và unread count',
    },
  });
  const permWrite = await prisma.permission.upsert({
    where: { code: 'notifications:write' },
    update: {},
    create: {
      code: 'notifications:write',
      description: 'Đánh dấu đọc / read-all thông báo',
    },
  });

  // 2. Roles
  const roleUser = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'User thường - chỉ notifications:read',
    },
  });
  const roleAdmin = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Admin - đủ notifications:read + notifications:write',
    },
  });

  // 3. RolePermission: user = read, admin = read + write
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: { roleId: roleUser.id, permissionId: permRead.id },
    },
    update: {},
    create: { roleId: roleUser.id, permissionId: permRead.id },
  });
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: { roleId: roleAdmin.id, permissionId: permRead.id },
    },
    update: {},
    create: { roleId: roleAdmin.id, permissionId: permRead.id },
  });
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: { roleId: roleAdmin.id, permissionId: permWrite.id },
    },
    update: {},
    create: { roleId: roleAdmin.id, permissionId: permWrite.id },
  });

  console.log('Role seed OK: permissions notifications:read, notifications:write; roles user, admin.');
  return { roleUser, roleAdmin };
}
