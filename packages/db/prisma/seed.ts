import { PrismaClient, Role, EmployeeStatus, LeaveType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

declare const process: any;

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

  let superAdminRecord = await prisma.employee.findFirst({
    where: { OR: [{ employeeCode: 'NXG-001' }, { email: 'superadmin@nexgen.in' }, { email: 'ashwani@nexgenpharmasolutions.com' }] }
  });

  if (superAdminRecord) {
    await prisma.employee.update({
      where: { id: superAdminRecord.id },
      data: {
        email: 'ashwani@nexgenpharmasolutions.com',
        firstName: 'Ashwani',
        lastName: 'Shrivastav',
        passwordHash: superAdminHash,
        role: Role.SUPER_ADMIN,
      }
    });
  } else {
    await prisma.employee.create({
      data: {
        employeeCode: 'NXG-001',
        email:        'ashwani@nexgenpharmasolutions.com',
        passwordHash: superAdminHash,
        firstName:    'Ashwani',
        lastName:     'Shrivastav',
        role:         Role.SUPER_ADMIN,
        status:       EmployeeStatus.ACTIVE,
        joiningDate:  new Date('2024-01-01'),
      }
    });
  }

  const superAdmin = await prisma.employee.findUnique({
    where: { email: 'ashwani@nexgenpharmasolutions.com' }
  });
  if (superAdmin) {
    await seedLeaves(superAdmin.id);
  }
  console.log(`✓ Super Admin   →  ashwani@nexgenpharmasolutions.com  /  Admin@123456`);

  // ── Admin ────────────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin@123456', 10);

  let adminRecord = await prisma.employee.findFirst({
    where: { OR: [{ employeeCode: 'NXG-002' }, { email: 'admin@nexgen.in' }, { email: 'pratham.s@nexgenharmasolutions.com' }] }
  });

  if (adminRecord) {
    await prisma.employee.update({
      where: { id: adminRecord.id },
      data: {
        email: 'pratham.s@nexgenharmasolutions.com',
        firstName: 'Pratham',
        lastName: 'Shrivastav',
        passwordHash: adminHash,
        role: Role.SUPER_ADMIN,
      }
    });
  } else {
    await prisma.employee.create({
      data: {
        employeeCode: 'NXG-002',
        email:        'pratham.s@nexgenharmasolutions.com',
        passwordHash: adminHash,
        firstName:    'Pratham',
        lastName:     'Shrivastav',
        role:         Role.SUPER_ADMIN,
        status:       EmployeeStatus.ACTIVE,
        joiningDate:  new Date('2024-01-01'),
      }
    });
  }

  const admin = await prisma.employee.findUnique({
    where: { email: 'pratham.s@nexgenharmasolutions.com' }
  });
  if (admin) {
    await seedLeaves(admin.id);
  }
  console.log(`✓ Super Admin   →  pratham.s@nexgenharmasolutions.com       /  Admin@123456`);

  // ── Departments ──────────────────────────────────────────────────────────────
  console.log(`\n── Seeding Departments ──────────────────────────`);
  
  const qaDept = await prisma.department.upsert({
    where: { name: 'Quality Assurance' },
    update: {},
    create: { name: 'Quality Assurance' },
  });
  console.log(`✓ Department: Quality Assurance`);

  const swDept = await prisma.department.upsert({
    where: { name: 'Software Development' },
    update: {},
    create: { name: 'Software Development' },
  });
  console.log(`✓ Department: Software Development`);

  const raDept = await prisma.department.upsert({
    where: { name: 'Regulatory Affairs' },
    update: {},
    create: { name: 'Regulatory Affairs' },
  });
  console.log(`✓ Department: Regulatory Affairs`);

  // ── New Employees ────────────────────────────────────────────────────────────
  console.log(`\n── Seeding New Employees ────────────────────────`);

  // 1. Chandni Jha
  const chandniPassword = 'Chandni@NEX2026';
  const chandniHash = await bcrypt.hash(chandniPassword, 10);
  
  let chandniRecord = await prisma.employee.findFirst({
    where: { OR: [{ employeeCode: 'NEX-QA-001' }, { email: 'chandni.jha@nexgen.in' }, { email: 'chandni.jha@nexgenharmasolutions.com' }] }
  });

  if (chandniRecord) {
    await prisma.employee.update({
      where: { id: chandniRecord.id },
      data: {
        email: 'chandni.jha@nexgenharmasolutions.com',
        passwordHash: chandniHash,
        firstName: 'Chandni',
        lastName: 'Jha',
      }
    });
  } else {
    await prisma.employee.create({
      data: {
        employeeCode: 'NEX-QA-001',
        email:        'chandni.jha@nexgenharmasolutions.com',
        passwordHash: chandniHash,
        firstName:    'Chandni',
        lastName:     'Jha',
        phone:        '+919879174185',
        role:         Role.EMPLOYEE,
        status:       EmployeeStatus.ACTIVE,
        joiningDate:  new Date('2026-06-01'), // Tentative June 1st joining
        designation:  'QA Chemist',
        departmentId: qaDept.id,
      }
    });
  }

  const chandni = await prisma.employee.findUnique({
    where: { email: 'chandni.jha@nexgenharmasolutions.com' }
  });
  if (chandni) {
    await seedLeaves(chandni.id);
  }
  console.log(`✓ Employee 1    →  chandni.jha@nexgenharmasolutions.com  /  ${chandniPassword}`);

  // 2. Dev Patel
  const devPassword = 'Dev@NEX2026';
  const devHash = await bcrypt.hash(devPassword, 10);
  
  let devRecord = await prisma.employee.findFirst({
    where: { OR: [{ employeeCode: 'NEX-SW-INT-001' }, { email: 'dev.patel@nexgen.in' }] }
  });

  if (devRecord) {
    await prisma.employee.update({
      where: { id: devRecord.id },
      data: {
        email: 'dev.patel@praversetech.com',
        passwordHash: devHash,
        firstName: 'Dev',
        lastName: 'Patel',
      }
    });
  } else {
    await prisma.employee.create({
      data: {
        employeeCode: 'NEX-SW-INT-001',
        email:        'dev.patel@praversetech.com',
        passwordHash: devHash,
        firstName:    'Dev',
        lastName:     'Patel',
        role:         Role.EMPLOYEE,
        status:       EmployeeStatus.ACTIVE,
        joiningDate:  new Date('2026-01-09'),
        designation:  'Software Development Intern',
        departmentId: swDept.id,
      }
    });
  }

  const dev = await prisma.employee.findUnique({
    where: { email: 'dev.patel@praversetech.com' }
  });
  if (dev) {
    await seedLeaves(dev.id);
  }
  console.log(`✓ Employee 2    →  dev.patel@praversetech.com    /  ${devPassword}`);

  // 3. Maanav Shah
  const maanavPassword = 'Maanav@NEX2026';
  const maanavHash = await bcrypt.hash(maanavPassword, 10);
  
  let maanavRecord = await prisma.employee.findFirst({
    where: { OR: [{ employeeCode: 'NEX-SW-INT-002' }, { email: 'maanav.shah@nexgen.in' }] }
  });

  if (maanavRecord) {
    await prisma.employee.update({
      where: { id: maanavRecord.id },
      data: {
        email: 'maanav.shah@praversetech.com',
        passwordHash: maanavHash,
        firstName: 'Maanav',
        lastName: 'Shah',
      }
    });
  } else {
    await prisma.employee.create({
      data: {
        employeeCode: 'NEX-SW-INT-002',
        email:        'maanav.shah@praversetech.com',
        passwordHash: maanavHash,
        firstName:    'Maanav',
        lastName:     'Shah',
        role:         Role.EMPLOYEE,
        status:       EmployeeStatus.ACTIVE,
        joiningDate:  new Date('2026-01-05'),
        designation:  'Software Development Intern',
        departmentId: swDept.id,
      }
    });
  }

  const maanav = await prisma.employee.findUnique({
    where: { email: 'maanav.shah@praversetech.com' }
  });
  if (maanav) {
    await seedLeaves(maanav.id);
  }
  console.log(`✓ Employee 3    →  maanav.shah@praversetech.com   /  ${maanavPassword}`);

  // 4. Shifa Mobh
  const shifaPassword = 'Shifa@NEX2026';
  const shifaHash = await bcrypt.hash(shifaPassword, 10);
  
  let shifaRecord = await prisma.employee.findFirst({
    where: { OR: [{ employeeCode: 'NEX-RA-001' }, { email: 'shifa.mobh@nexgen.in' }, { email: 'shifa.mobh@nexgenharmasolutions.com' }] }
  });

  if (shifaRecord) {
    await prisma.employee.update({
      where: { id: shifaRecord.id },
      data: {
        email: 'shifa.mobh@nexgenharmasolutions.com',
        passwordHash: shifaHash,
        firstName: 'Shifa',
        lastName: 'Mobh',
      }
    });
  } else {
    await prisma.employee.create({
      data: {
        employeeCode: 'NEX-RA-001',
        email:        'shifa.mobh@nexgenharmasolutions.com',
        passwordHash: shifaHash,
        firstName:    'Shifa',
        lastName:     'Mobh',
        role:         Role.EMPLOYEE,
        status:       EmployeeStatus.ACTIVE,
        joiningDate:  new Date('2026-02-02'),
        designation:  'Officer – Regulatory Affairs',
        departmentId: raDept.id,
      }
    });
  }

  const shifa = await prisma.employee.findUnique({
    where: { email: 'shifa.mobh@nexgenharmasolutions.com' }
  });
  if (shifa) {
    await seedLeaves(shifa.id);
  }
  console.log(`✓ Employee 4    →  shifa.mobh@nexgenharmasolutions.com   /  ${shifaPassword}`);

  console.log(`\n── Done ─────────────────────────────────────────\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
