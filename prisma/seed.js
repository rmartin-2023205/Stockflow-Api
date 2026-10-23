import { prisma } from '../src/config/prisma.js';

async function main() {
  console.log('🌱 Seed script baseline initialized. Ready for Phase 2 data seeding.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
