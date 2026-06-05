import { PrismaClient, Role, EmployeeStatus, LeaveType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

declare const process: any;

const prisma = new PrismaClient();

const PERMANENT_LEAVE_DEFAULTS = [
  { leaveType: LeaveType.CL, totalDays: 7  },
  { leaveType: LeaveType.SL, totalDays: 7  },
  { leaveType: LeaveType.PL, totalDays: 14 },
  { leaveType: LeaveType.UL, totalDays: 0  },
  { leaveType: LeaveType.CO, totalDays: 0  },
];

const INTERN_LEAVE_DEFAULTS = PERMANENT_LEAVE_DEFAULTS.map((leave) => ({
  ...leave,
  totalDays: 0,
}));

type SeedEmployee = Awaited<ReturnType<typeof prisma.employee.findUnique>>;



async function seedLeaves(employeeId: string, isIntern = false) {
  const year = new Date().getFullYear();
  const defaults = isIntern ? INTERN_LEAVE_DEFAULTS : PERMANENT_LEAVE_DEFAULTS;
  for (const leave of defaults) {
    await prisma.leaveBalance.upsert({
      where: { employeeId_leaveType_year: { employeeId, leaveType: leave.leaveType, year } },
      update: { totalDays: leave.totalDays },
      create: { employeeId, year, ...leave, usedDays: 0 },
    });
  }
}

async function seedSalaryStructure(
  employeeId: string,
  effectiveFrom: string,
  monthlyAmount: number,
  notes: string,
  approvedBy?: string,
) {
  await prisma.salaryStructure.upsert({
    where: {
      employeeId_effectiveFrom: {
        employeeId,
        effectiveFrom: new Date(effectiveFrom),
      },
    },
    update: {
      basic: monthlyAmount,
      hra: 0,
      allowances: 0,
      pfDeduction: 0,
      professionalTax: 0,
      tds: 0,
      notes,
      approvedBy,
      approvedAt: approvedBy ? new Date() : undefined,
    },
    create: {
      employeeId,
      basic: monthlyAmount,
      hra: 0,
      allowances: 0,
      pfDeduction: 0,
      professionalTax: 0,
      tds: 0,
      effectiveFrom: new Date(effectiveFrom),
      notes,
      approvedBy,
      approvedAt: approvedBy ? new Date() : undefined,
    },
  });
}

async function upsertSalarySlip(
  employee: NonNullable<SeedEmployee>,
  uploadedBy: string,
  month: number,
  year: number,
  amount: number,
  notes: string,
  status: 'DRAFT' | 'APPROVED' | 'TRANSFERRED' = 'APPROVED',
) {
  const now = new Date();
  await prisma.salarySlip.upsert({
    where: {
      employeeId_month_year: {
        employeeId: employee.id,
        month,
        year,
      },
    },
    update: {
      baseSalary: amount,
      incentives: 0,
      reimbursements: 0,
      grossSalary: amount,
      deductions: 0,
      netPayable: amount,
      lopDays: 0,
      daysPresent: 30,
      notes,
      status,
      approvedBy: uploadedBy,
      approvedAt: now,
      transferredAt: status === 'TRANSFERRED' ? now : null,
      paymentRef: status === 'TRANSFERRED' ? `SEEDED-${year}-${String(month).padStart(2, '0')}` : null,
      slipPdfS3Key: `salary-slips/${year}/${String(month).padStart(2, '0')}/${employee.employeeCode}.pdf`,
    },
    create: {
      employeeId: employee.id,
      month,
      year,
      baseSalary: amount,
      incentives: 0,
      reimbursements: 0,
      grossSalary: amount,
      deductions: 0,
      netPayable: amount,
      lopDays: 0,
      daysPresent: 30,
      notes,
      status,
      uploadedBy,
      approvedBy: uploadedBy,
      approvedAt: now,
      transferredAt: status === 'TRANSFERRED' ? now : null,
      paymentRef: status === 'TRANSFERRED' ? `SEEDED-${year}-${String(month).padStart(2, '0')}` : null,
      slipPdfS3Key: `salary-slips/${year}/${String(month).padStart(2, '0')}/${employee.employeeCode}.pdf`,
    },
  });
}

async function seedMonthlySlips(
  employee: NonNullable<SeedEmployee>,
  uploadedBy: string,
  startMonth: number,
  endMonth: number,
  year: number,
  amount: number,
  notes: string,
  transferredMonths: number[] = [],
) {
  for (let month = startMonth; month <= endMonth; month += 1) {
    await upsertSalarySlip(
      employee,
      uploadedBy,
      month,
      year,
      amount,
      notes,
      transferredMonths.includes(month) ? 'TRANSFERRED' : 'APPROVED',
    );
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
        designation: 'Managing Director',
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
        designation:  'Managing Director',
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
    where: { OR: [{ employeeCode: 'NXG-002' }, { email: 'admin@nexgen.in' }, { email: 'pratham.s@nexgenharmasolutions.com' }, { email: 'pratham.s@nexgenpharmasolutions.com' }] }
  });

  if (adminRecord) {
    await prisma.employee.update({
      where: { id: adminRecord.id },
      data: {
        email: 'pratham.s@nexgenpharmasolutions.com',
        firstName: 'Pratham',
        lastName: 'Shrivastav',
        passwordHash: adminHash,
        role: Role.SUPER_ADMIN,
        designation: 'Director',
        salaryGrade: 'PERMANENT_FIXED_VARIABLE',
        grossSalary: 200000,
        joiningDate: new Date('2024-01-01'),
      }
    });
  } else {
    await prisma.employee.create({
      data: {
        employeeCode: 'NXG-002',
        email:        'pratham.s@nexgenpharmasolutions.com',
        passwordHash: adminHash,
        firstName:    'Pratham',
        lastName:     'Shrivastav',
        role:         Role.SUPER_ADMIN,
        status:       EmployeeStatus.ACTIVE,
        joiningDate:  new Date('2024-01-01'),
        designation:  'Director',
        salaryGrade:  'PERMANENT_FIXED_VARIABLE',
        grossSalary:  200000,
      }
    });
  }

  const admin = await prisma.employee.findUnique({
    where: { email: 'pratham.s@nexgenpharmasolutions.com' }
  });
  if (admin) {
    await seedLeaves(admin.id);
    await seedSalaryStructure(
      admin.id,
      '2026-01-01',
      100000,
      'Monthly fixed component INR 1,00,000. Variable component up to INR 1,00,000 per month to be updated by Pratham as applicable.',
      admin.id,
    );
    await seedMonthlySlips(
      admin,
      admin.id,
      1,
      5,
      year,
      100000,
      'Fixed monthly salary. Variable component is not included and will be updated by Pratham when applicable.',
    );
  }
  console.log(`✓ Super Admin   →  pratham.s@nexgenpharmasolutions.com      /  Admin@123456`);

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
    where: { OR: [{ employeeCode: 'NEX-QA-001' }, { email: 'chandni.jha@nexgen.in' }, { email: 'chandni.jha@nexgenharmasolutions.com' }, { email: 'chandni.jha@nexgenpharmasolutions.com' }] }
  });

  if (chandniRecord) {
    await prisma.employee.update({
      where: { id: chandniRecord.id },
      data: {
        email: 'chandni.jha@nexgenpharmasolutions.com',
        passwordHash: chandniHash,
        firstName: 'Chandni',
        lastName: 'Jha',
        joiningDate: new Date('2026-06-01'),
        designation: 'QA Chemist',
        departmentId: qaDept.id,
        salaryGrade: 'PERMANENT',
        grossSalary: 25000,
      }
    });
  } else {
    await prisma.employee.create({
      data: {
        employeeCode: 'NEX-QA-001',
        email:        'chandni.jha@nexgenpharmasolutions.com',
        passwordHash: chandniHash,
        firstName:    'Chandni',
        lastName:     'Jha',
        phone:        '+919879174185',
        role:         Role.EMPLOYEE,
        status:       EmployeeStatus.ACTIVE,
        joiningDate:  new Date('2026-06-01'), // Tentative June 1st joining
        designation:  'QA Chemist',
        departmentId: qaDept.id,
        salaryGrade:  'PERMANENT',
        grossSalary:  25000,
      }
    });
  }

  const chandni = await prisma.employee.findUnique({
    where: { email: 'chandni.jha@nexgenpharmasolutions.com' }
  });
  if (chandni) {
    await seedLeaves(chandni.id);
    await seedSalaryStructure(
      chandni.id,
      '2026-06-01',
      25000,
      'Permanent employee salary: INR 25,000 per month, no deductions.',
      admin?.id,
    );
  }
  console.log(`✓ Employee 1    →  chandni.jha@nexgenpharmasolutions.com  /  ${chandniPassword}`);

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
        joiningDate: new Date('2026-01-09'),
        designation: 'Software Development Intern',
        departmentId: swDept.id,
        salaryGrade: 'INTERN',
        grossSalary: 10000,
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
        salaryGrade:  'INTERN',
        grossSalary:  10000,
      }
    });
  }

  const dev = await prisma.employee.findUnique({
    where: { email: 'dev.patel@praversetech.com' }
  });
  if (dev) {
    await seedLeaves(dev.id, true);
    await seedSalaryStructure(
      dev.id,
      '2026-04-01',
      10000,
      'Intern stipend: INR 10,000 per month from April 2026 onward. Leave during internship is deductible/unpaid.',
      admin?.id,
    );
    await seedMonthlySlips(
      dev,
      admin?.id ?? dev.id,
      4,
      5,
      year,
      10000,
      'Intern stipend. Leave during internship period is deductible/unpaid. April stipend is payable/paid in May.',
      [4],
    );
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
        joiningDate: new Date('2026-01-05'),
        designation: 'Software Development Intern',
        departmentId: swDept.id,
        salaryGrade: 'INTERN',
        grossSalary: 10000,
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
        salaryGrade:  'INTERN',
        grossSalary:  10000,
      }
    });
  }

  const maanav = await prisma.employee.findUnique({
    where: { email: 'maanav.shah@praversetech.com' }
  });
  if (maanav) {
    await seedLeaves(maanav.id, true);
    await seedSalaryStructure(
      maanav.id,
      '2026-01-05',
      10000,
      'Intern stipend: INR 10,000 per month. Leave during internship is deductible/unpaid.',
      admin?.id,
    );
    await seedMonthlySlips(
      maanav,
      admin?.id ?? maanav.id,
      1,
      5,
      year,
      10000,
      'Intern stipend. Leave during internship period is deductible/unpaid.',
    );
  }
  console.log(`✓ Employee 3    →  maanav.shah@praversetech.com   /  ${maanavPassword}`);

  // 4. Shifa Mobh
  const shifaPassword = 'Shifa@NEX2026';
  const shifaHash = await bcrypt.hash(shifaPassword, 10);
  
  let shifaRecord = await prisma.employee.findFirst({
    where: { OR: [{ employeeCode: 'NEX-RA-001' }, { email: 'shifa.mobh@nexgen.in' }, { email: 'shifa.mobh@nexgenharmasolutions.com' }, { email: 'shifa.mobh@nexgenpharmasolutions.com' }] }
  });

  if (shifaRecord) {
    await prisma.employee.update({
      where: { id: shifaRecord.id },
      data: {
        email: 'shifa.mobh@nexgenpharmasolutions.com',
        passwordHash: shifaHash,
        firstName: 'Shifa',
        lastName: 'Mobh',
        joiningDate: new Date('2026-02-02'),
        designation: 'Officer - Regulatory Affairs',
        departmentId: raDept.id,
        salaryGrade: 'PERMANENT',
        grossSalary: 25000,
      }
    });
  } else {
    await prisma.employee.create({
      data: {
        employeeCode: 'NEX-RA-001',
        email:        'shifa.mobh@nexgenpharmasolutions.com',
        passwordHash: shifaHash,
        firstName:    'Shifa',
        lastName:     'Mobh',
        role:         Role.EMPLOYEE,
        status:       EmployeeStatus.ACTIVE,
        joiningDate:  new Date('2026-02-02'),
        designation:  'Officer - Regulatory Affairs',
        departmentId: raDept.id,
        salaryGrade:  'PERMANENT',
        grossSalary:  25000,
      }
    });
  }

  const shifa = await prisma.employee.findUnique({
    where: { email: 'shifa.mobh@nexgenpharmasolutions.com' }
  });
  if (shifa) {
    await seedLeaves(shifa.id);
    await seedSalaryStructure(
      shifa.id,
      '2026-02-02',
      25000,
      'Permanent employee salary: INR 25,000 per month, no deductions.',
      admin?.id,
    );
    await seedMonthlySlips(
      shifa,
      admin?.id ?? shifa.id,
      2,
      5,
      year,
      25000,
      'Monthly salary, no deductions.',
    );
  }
  console.log(`✓ Employee 4    →  shifa.mobh@nexgenpharmasolutions.com   /  ${shifaPassword}`);

  // ── Office Location (Geo-fence) ──────────────────────────────────────────────
  console.log(`\n── Seeding Office Location ──────────────────────`);
  const existingOffice = await prisma.officeLocation.findFirst({
    where: { name: 'Nexgen Pharma Solutions — Gotri Office' },
  });
  if (!existingOffice) {
    await prisma.officeLocation.create({
      data: {
        name:         'Nexgen Pharma Solutions — Gotri Office',
        latitude:     22.3097,   // Prince Cube, 30 Mtr Road, Gotri, Vadodara
        longitude:    73.1376,
        radiusMeters: 150,
        isActive:     true,
      },
    });
    console.log(`✓ Office location created (lat 22.3097, lng 73.1376, radius 150 m)`);
  } else {
    console.log(`✓ Office location already exists — skipped`);
  }

  // ── Company Address Setting ───────────────────────────────────────────────────
  console.log(`\n── Seeding Company Settings ─────────────────────`);
  await prisma.companySetting.upsert({
    where: { key: 'company_address' },
    update: {
      value: {
        line1:   '413 & 420, Prince Cube',
        line2:   'Beside Gangotri Exotica, Laxmipura Char Rasta, Nayaran Garden',
        line3:   '30 Mtr Road, Gotri',
        city:    'Vadodara',
        state:   'Gujarat',
        pincode: '390023',
        country: 'India',
        full:    '413 & 420, Prince Cube, Beside Gangotri Exotica, Laxmipura Char Rasta, Nayaran Garden, 30 Mtr Road, Gotri, Vadodara, Gujarat 390023, India',
      } as any,
      updatedBy: superAdmin?.id ?? '',
    },
    create: {
      key:       'company_address',
      value: {
        line1:   '413 & 420, Prince Cube',
        line2:   'Beside Gangotri Exotica, Laxmipura Char Rasta, Nayaran Garden',
        line3:   '30 Mtr Road, Gotri',
        city:    'Vadodara',
        state:   'Gujarat',
        pincode: '390023',
        country: 'India',
        full:    '413 & 420, Prince Cube, Beside Gangotri Exotica, Laxmipura Char Rasta, Nayaran Garden, 30 Mtr Road, Gotri, Vadodara, Gujarat 390023, India',
      } as any,
      updatedBy: superAdmin?.id ?? '',
    },
  });
  console.log(`✓ Company address setting saved`);

  console.log(`\n── Done ─────────────────────────────────────────\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
