import { prisma } from './index.js';

async function main() {
  const user = await prisma.user.create({
    data: {
      username: 'smoke_test',
      email: 'smoke@test.local',
      provider: 'LOCAL',
      passwordHash: 'x',
    },
  });
  console.log('created:', user);

  const found = await prisma.user.findUnique({ where: { id: user.id } });
  console.log('found:', found);

  await prisma.user.delete({ where: { id: user.id } });
  console.log('OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());