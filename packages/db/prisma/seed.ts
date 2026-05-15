import { PrismaClient, Role, EmployeeStatus, LeaveType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ── Admin user ──────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123456', 10);

  // Remove stale seed records that conflict on employeeCode
  await prisma.employee.deleteMany({
    where: { employeeCode: 'EMP001', NOT: { email: 'admin@nexgen.in' } },
  });

  const admin = await prisma.employee.upsert({
    where: { email: 'admin@nexgen.in' },
    update: { passwordHash },
    create: {
      employeeCode: 'EMP001',
      email: 'admin@nexgen.in',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: Role.SUPER_ADMIN,
      status: EmployeeStatus.ACTIVE,
      joiningDate: new Date('2024-01-01'),
    },
  });

  console.log(`✓ Admin seeded: ${admin.email}`);

  // ── Default leave balances ───────────────────────────────────────────────────
  const year = new Date().getFullYear();
  const leaveDefaults = [
    { leaveType: LeaveType.CL, totalDays: 12 },
    { leaveType: LeaveType.SL, totalDays: 10 },
    { leaveType: LeaveType.PL, totalDays: 15 },
    { leaveType: LeaveType.UL, totalDays: 0  },
    { leaveType: LeaveType.CO, totalDays: 0  },
  ];

  for (const leave of leaveDefaults) {
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveType_year: { employeeId: admin.id, leaveType: leave.leaveType, year } },
      update: {},
      create: { employeeId: admin.id, ...leave, year },
    });
  }

  console.log(`✓ Leave balances seeded for ${admin.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
