import type { PrismaClient } from '.prisma/auth-client';
import * as argon2 from 'argon2';

const SEED_ADMIN_EMAIL = 'admin@example.com';
const SEED_ADMIN_PASSWORD = 'Admin@123';
const SEED_USER_EMAIL = 'user@example.com';
const SEED_USER_PASSWORD = 'User@123';

export async function runUserSeed(prisma: PrismaClient) {
  const adminHash = await argon2.hash(SEED_ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });
  const userHash = await argon2.hash(SEED_USER_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });

  const admin = await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: {},
    create: {
      email: SEED_ADMIN_EMAIL,
      passwordHash: adminHash,
      name: 'Admin Seed',
      isActive: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: SEED_USER_EMAIL },
    update: {},
    create: {
      email: SEED_USER_EMAIL,
      passwordHash: userHash,
      name: 'User Seed',
      isActive: true,
    },
  });

  const roleAdmin = await prisma.role.findUnique({ where: { name: 'admin' } });
  const roleUser = await prisma.role.findUnique({ where: { name: 'user' } });
  if (!roleAdmin || !roleUser) throw new Error('Run role seed first.');

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleAdmin.id } },
    update: {},
    create: { userId: admin.id, roleId: roleAdmin.id },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: roleUser.id } },
    update: {},
    create: { userId: user.id, roleId: roleUser.id },
  });

  console.log('User seed OK:', SEED_ADMIN_EMAIL, '(admin),', SEED_USER_EMAIL, '(user).');
  console.log('  Passwords:', SEED_ADMIN_PASSWORD, '/', SEED_USER_PASSWORD);
}
