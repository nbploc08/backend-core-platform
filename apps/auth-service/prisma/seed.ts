import { PrismaClient } from '.prisma/auth-client';
import { runRoleSeed } from './seed/role.seed';
import { runUserSeed } from './seed/user.seed';

const prisma = new PrismaClient();

async function main() {
  await runRoleSeed(prisma);
  await runUserSeed(prisma);
  console.log('All seeds done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
