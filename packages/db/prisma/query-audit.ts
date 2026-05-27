import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== LATEST 10 AUDIT LOGS ===");
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      actor: { select: { firstName: true, role: true } }
    }
  });
  console.log(JSON.stringify(logs, null, 2));

  console.log("=== LATEST 5 ATTENDANCE RECORDS ===");
  const att = await prisma.attendanceRecord.findMany({
    orderBy: { date: 'desc' },
    take: 5,
    include: {
      employee: { select: { firstName: true, role: true } }
    }
  });
  console.log(JSON.stringify(att, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
