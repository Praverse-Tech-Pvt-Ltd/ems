import { PrismaClient, Role, EmployeeStatus, LeaveType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const LEAVE_DEFAULTS = [
  { leaveType: LeaveType.CL, totalDays: 7  },
  { leaveType: LeaveType.SL, totalDays: 7  },
  { leaveType: LeaveType.PL, totalDays: 14 },
  { leaveType: LeaveType.UL, totalDays: 0  },
  { leaveType: LeaveType.CO, totalDays: 0  },
];

async function seedLeaves(employeeId: string) {
  const year = new Date().getFullYear();
  for (const leave of LEAVE_DEFAULTS) {
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveType_year: { employeeId, leaveType: leave.leaveType, year } },
      update: { totalDays: leave.totalDays },
      create: { employeeId, year, ...leave, usedDays: 0 },
    });
  }
}

async function main() {
  const year = new Date().getFullYear();
  console.log(`\n── NexGen EMS Seed ─────────────────────────────`);
  console.log(`   Leave year: ${year}`);
  console.log(`   Allocations: CL=7  SL=7  PL=14\n`);

  // ── Super Admin ──────────────────────────────────────────────────────────────
  const superAdminHash = await bcrypt.hash('Admin@123456', 10);

  await prisma.employee.deleteMany({
    where: { employeeCode: 'NXG-001', NOT: { email: 'superadmin@nexgen.in' } },
  });

  const superAdmin = await prisma.employee.upsert({
    where: { email: 'superadmin@nexgen.in' },
    update: { passwordHash: superAdminHash, role: Role.SUPER_ADMIN },
    create: {
      employeeCode: 'NXG-001',
      email:        'superadmin@nexgen.in',
      passwordHash: superAdminHash,
      firstName:    'Super',
      lastName:     'Admin',
      role:         Role.SUPER_ADMIN,
      status:       EmployeeStatus.ACTIVE,
      joiningDate:  new Date('2024-01-01'),
    },
  });

  await seedLeaves(superAdmin.id);
  console.log(`✓ Super Admin   →  superadmin@nexgen.in  /  Admin@123456`);

  // ── Admin ────────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123456', 10);

  await prisma.employee.deleteMany({
    where: { employeeCode: 'NXG-002', NOT: { email: 'admin@nexgen.in' } },
  });

  const admin = await prisma.employee.upsert({
    where: { email: 'admin@nexgen.in' },
    update: { passwordHash: adminHash, role: Role.ADMIN },
    create: {
      employeeCode: 'NXG-002',
      email:        'admin@nexgen.in',
      passwordHash: adminHash,
      firstName:    'Admin',
      lastName:     'User',
      role:         Role.ADMIN,
      status:       EmployeeStatus.ACTIVE,
      joiningDate:  new Date('2024-01-01'),
    },
  });

  await seedLeaves(admin.id);
  console.log(`✓ Admin         →  admin@nexgen.in       /  Admin@123456`);

  console.log(`\n── Done ─────────────────────────────────────────\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
