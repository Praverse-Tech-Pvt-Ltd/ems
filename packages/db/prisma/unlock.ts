import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Attempting to terminate other active database connections...');
  try {
    const result = await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND datname = current_database();
    `);
    console.log('Successfully terminated other connections. Result:', result);
  } catch (error) {
    console.error('Error terminating connections:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
