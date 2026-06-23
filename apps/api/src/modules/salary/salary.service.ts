import { BadRequestException, Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { PDFParse } from 'pdf-parse';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { GenerateSalarySlipDto, UpsertSalaryStructureDto } from './dto/create-slip.dto';

export interface UploadSlipData {
  employeeId: string;
  month: number;
  year: number;
  grossSalary: number;
  deductions: number;
  netPayable: number;
  lopDays: number;
  daysPresent: number;
  slipPdfS3Key: string;
}

interface PayrollDayCounts {
  monthDays: number;
  workingDays: number;
  paidDays: number;
  lopDays: number;
  presentDays: number;
  lateDays: number;
  wfhDays: number;
  halfDays: number;
  leaveDays: number;
  holidayDays: number;
  weekOffDays: number;
  absentDays: number;
  missingPunchDays: number;
}

type ReconciliationDocumentType = 'WAGE_SHEET' | 'EPF_ECR' | 'ESIC_ECR';

export interface ExtractedPayrollRow {
  source: ReconciliationDocumentType;
  name: string;
  uan?: string;
  esicIpNumber?: string;
  paidDays?: number;
  grossSalary?: number;
  pfDeduction?: number;
  esicDeduction?: number;
  professionalTax?: number;
  deductions?: number;
  netPayable?: number;
}

@Injectable()
export class SalaryService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async upload(uploadedBy: string, data: UploadSlipData) {
    const existing = await this.prisma.salarySlip.findUnique({
      where: {
        employeeId_month_year: {
          employeeId: data.employeeId,
          month: data.month,
          year: data.year,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Salary slip already exists for this month/year');
    }

    return this.prisma.salarySlip.create({
      data: { ...data, uploadedBy, status: 'APPROVED', approvedBy: uploadedBy, approvedAt: new Date() },
    });
  }

  async listStructures() {
    const rows = await this.prisma.salaryStructure.findMany({
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                email: true,
                designation: true,
                salaryGrade: true,
              },
            },
            approver: { select: { firstName: true, lastName: true } },
          },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows.map((row) => this.toPlain(row));
  }

  async upsertStructure(adminId: string, employeeId: string, dto: UpsertSalaryStructureDto) {
    await this.ensureEmployee(employeeId);
    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException('Invalid effective date');
    }

    const data = {
      basic: dto.basic,
      hra: dto.hra ?? 0,
      allowances: dto.allowances ?? 0,
      pfDeduction: dto.pfDeduction ?? 0,
      professionalTax: dto.professionalTax ?? 0,
      tds: dto.tds ?? 0,
      effectiveFrom,
      approvedBy: adminId,
      approvedAt: new Date(),
      signatureName: dto.signatureName,
      signatureTitle: dto.signatureTitle,
      notes: dto.notes,
    };

    const row = await this.prisma.salaryStructure.upsert({
      where: {
        employeeId_effectiveFrom: {
          employeeId,
          effectiveFrom,
        },
      },
      update: data,
      create: { employeeId, ...data },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true, designation: true, salaryGrade: true } },
        approver: { select: { firstName: true, lastName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'SALARY_STRUCTURE_UPSERT',
        resourceType: 'salary_structure',
        resourceId: row.id,
        newValue: this.toPlain(row),
      },
    });

    return this.toPlain(row);
  }

  async generatePayrollRun(adminId: string, dto: { month: number; year: number; notes?: string }) {
    const existingRun = await this.prisma.payrollRun.findUnique({
      where: { month_year: { month: dto.month, year: dto.year } },
    });
    if (existingRun?.status === 'APPROVED') {
      throw new BadRequestException('Approved payroll runs cannot be regenerated');
    }

    const run = await this.prisma.payrollRun.upsert({
      where: { month_year: { month: dto.month, year: dto.year } },
      update: {
        status: 'DRAFT',
        generatedBy: adminId,
        notes: dto.notes,
      },
      create: {
        month: dto.month,
        year: dto.year,
        generatedBy: adminId,
        notes: dto.notes,
      },
    });

    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        department: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const rows = await Promise.all(
      employees.map(async (employee) => {
        const structure = await this.prisma.salaryStructure.findFirst({
          where: {
            employeeId: employee.id,
            effectiveFrom: { lte: new Date(dto.year, dto.month - 1, 1) },
          },
          orderBy: { effectiveFrom: 'desc' },
        });

        const baseSalary = structure
          ? this.money(structure.basic) + this.money(structure.hra) + this.money(structure.allowances)
          : this.money(employee.grossSalary);
        const counts = await this.calculatePayrollDays(employee.id, employee.joiningDate, employee.department?.name, dto.month, dto.year);
        const paidFactor = counts.monthDays > 0 ? counts.paidDays / counts.monthDays : 0;
        const earnedBaseSalary = this.roundMoney(baseSalary * paidFactor);
        const reimbursements = await this.approvedReimbursements(employee.id, dto.month, dto.year);
        const incentives = 0;
        const isIntern = employee.salaryGrade === 'INTERN';
        const pfDeduction = this.roundMoney(this.money(structure?.pfDeduction) * paidFactor);
        const professionalTax = earnedBaseSalary > 0 ? this.money(structure?.professionalTax) : 0;
        const tds = this.roundMoney(this.money(structure?.tds) * paidFactor);
        const grossSalary = this.roundMoney(earnedBaseSalary + incentives + reimbursements);
        const esicDeduction = !isIntern && baseSalary > 0 && baseSalary <= 21000
          ? this.roundMoney(grossSalary * 0.0075)
          : 0;
        const deductions = this.roundMoney(pfDeduction + professionalTax + tds + esicDeduction);
        const netPayable = Math.max(this.roundMoney(grossSalary - deductions), 0);

        return {
          payrollRunId: run.id,
          employeeId: employee.id,
          monthDays: counts.monthDays,
          workingDays: counts.workingDays,
          paidDays: counts.paidDays,
          lopDays: counts.lopDays,
          presentDays: counts.presentDays,
          lateDays: counts.lateDays,
          wfhDays: counts.wfhDays,
          halfDays: counts.halfDays,
          leaveDays: counts.leaveDays,
          holidayDays: counts.holidayDays,
          weekOffDays: counts.weekOffDays,
          absentDays: counts.absentDays,
          missingPunchDays: counts.missingPunchDays,
          baseSalary,
          earnedBaseSalary,
          incentives,
          reimbursements,
          grossSalary,
          pfDeduction,
          esicDeduction,
          professionalTax,
          tds,
          deductions,
          netPayable,
          calculationSnapshot: {
            source: 'EMS_ATTENDANCE',
            month: dto.month,
            year: dto.year,
            paidFactor,
            salarySource: structure ? 'salary_structure' : 'employee_gross_salary',
            statutoryBasis: {
              employeePf: '12% of Basic, capped to INR 15,000 PF wage base',
              employerPf: 'Shown in UI as EPF/EPS split; not deducted from employee net pay',
              esic: 'Employee ESIC 0.75% only when non-intern gross wage is up to INR 21,000',
              professionalTax: 'Gujarat PT INR 200 when monthly salary exceeds INR 12,000',
              interns: 'Intern stipends are kept outside statutory payroll deductions unless HR converts them to salary employees',
            },
          },
        };
      }),
    );

    await this.prisma.$transaction([
      this.prisma.payrollRunEmployee.deleteMany({ where: { payrollRunId: run.id } }),
      ...rows.map((row) => this.prisma.payrollRunEmployee.create({ data: row as any })),
    ]);

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: existingRun ? 'PAYROLL_RUN_REGENERATED' : 'PAYROLL_RUN_GENERATED',
        resourceType: 'payroll_run',
        resourceId: run.id,
        newValue: { month: dto.month, year: dto.year, rows: rows.length } as object,
      },
    });

    return this.findPayrollRun(run.id);
  }

  async listPayrollRuns(month?: number, year?: number) {
    const rows = await this.prisma.payrollRun.findMany({
      where: {
        ...(month ? { month } : {}),
        ...(year ? { year } : {}),
      },
      include: {
        generator: { select: { firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } },
        rows: { select: { netPayable: true, grossSalary: true, deductions: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((run) => ({
      ...this.toPlain(run),
      totals: {
        employees: run.rows.length,
        grossSalary: run.rows.reduce((sum, row) => sum + this.money(row.grossSalary), 0),
        deductions: run.rows.reduce((sum, row) => sum + this.money(row.deductions), 0),
        netPayable: run.rows.reduce((sum, row) => sum + this.money(row.netPayable), 0),
      },
    }));
  }

  async findPayrollRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        generator: { select: { firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } },
        rows: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true, department: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');

    return {
      ...this.toPlain(run),
      totals: {
        employees: run.rows.length,
        grossSalary: run.rows.reduce((sum, row) => sum + this.money(row.grossSalary), 0),
        deductions: run.rows.reduce((sum, row) => sum + this.money(row.deductions), 0),
        netPayable: run.rows.reduce((sum, row) => sum + this.money(row.netPayable), 0),
      },
    };
  }

  async markPayrollRunReviewed(adminId: string, id: string) {
    const existing = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Payroll run not found');
    if (existing.status === 'APPROVED') {
      throw new BadRequestException('Approved payroll runs cannot be marked reviewed again');
    }
    const run = await this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'REVIEWED', approvedBy: adminId, approvedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'PAYROLL_RUN_REVIEWED',
        resourceType: 'payroll_run',
        resourceId: id,
        newValue: { status: run.status } as object,
      },
    });

    return this.findPayrollRun(id);
  }

  async autoRefreshWeeklyPayrollRun() {
    const { month, year } = this.currentPayrollPeriodInIst();
    const existingRun = await this.prisma.payrollRun.findUnique({
      where: { month_year: { month, year } },
      select: { id: true, status: true },
    });

    if (existingRun?.status === 'APPROVED') {
      return {
        skipped: true,
        reason: 'Payroll run is approved',
        month,
        year,
        id: existingRun.id,
      };
    }

    const systemUser = await this.prisma.employee.findFirst({
      where: {
        status: 'ACTIVE',
        role: { in: ['SUPER_ADMIN', 'ADMIN'] },
      },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    if (!systemUser) {
      throw new BadRequestException('No active admin user found for weekly payroll refresh');
    }

    const run = await this.generatePayrollRun(systemUser.id, {
      month,
      year,
      notes: `Auto-refreshed by weekly wage sheet scheduler on ${new Date().toISOString()}`,
    });

    return {
      skipped: false,
      month,
      year,
      id: run.id,
      status: run.status,
      totals: run.totals,
    };
  }

  async reconcilePayrollRun(
    adminId: string,
    id: string,
    documentType: ReconciliationDocumentType,
    file?: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Upload a PDF file to reconcile');
    }

    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: {
        rows: {
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');

    const parser = new PDFParse({ data: file.buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const extractedRows = this.extractPayrollRows(parsed.text ?? '', documentType);
    const matches = extractedRows.map((externalRow) => {
      const match = this.matchPayrollRow(externalRow, run.rows);
      if (!match) {
        return {
          status: 'UNMATCHED_EXTERNAL',
          external: externalRow,
          differences: ['No EMS employee row matched this external row'],
        };
      }

      const differences = this.comparePayrollRows(externalRow, match);
      return {
        status: differences.length ? 'MISMATCH' : 'MATCH',
        employee: match.employee,
        external: externalRow,
        ems: {
          paidDays: this.money(match.paidDays),
          grossSalary: this.money(match.grossSalary),
          pfDeduction: this.money(match.pfDeduction),
          esicDeduction: this.money(match.esicDeduction),
          professionalTax: this.money(match.professionalTax),
          deductions: this.money(match.deductions),
          netPayable: this.money(match.netPayable),
        },
        differences,
      };
    });

    const matchedEmployeeIds = new Set(
      matches
        .filter((match: any) => match.employee?.id)
        .map((match: any) => match.employee.id),
    );
    const missingExternalRows = run.rows
      .filter((row) => !matchedEmployeeIds.has(row.employeeId))
      .map((row) => ({
        status: 'MISSING_EXTERNAL',
        employee: row.employee,
        ems: {
          paidDays: this.money(row.paidDays),
          grossSalary: this.money(row.grossSalary),
          deductions: this.money(row.deductions),
          netPayable: this.money(row.netPayable),
        },
        differences: ['No external document row matched this EMS employee'],
      }));

    const result = {
      documentType,
      fileName: file.originalname,
      extractedRows: extractedRows.length,
      summary: {
        matched: matches.filter((match) => match.status === 'MATCH').length,
        mismatched: matches.filter((match) => match.status === 'MISMATCH').length,
        unmatchedExternal: matches.filter((match) => match.status === 'UNMATCHED_EXTERNAL').length,
        missingExternal: missingExternalRows.length,
      },
      rows: [...matches, ...missingExternalRows],
    };

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'PAYROLL_RUN_RECONCILED',
        resourceType: 'payroll_run',
        resourceId: id,
        newValue: result as object,
      },
    });

    return result;
  }

  async generate(adminId: string, dto: GenerateSalarySlipDto) {
    const employee = await this.ensureEmployee(dto.employeeId);
    const structure = await this.prisma.salaryStructure.findFirst({
      where: {
        employeeId: dto.employeeId,
        effectiveFrom: { lte: new Date(dto.year, dto.month - 1, 1) },
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!structure) {
      throw new BadRequestException('Define salary structure before generating this slip');
    }

    const existing = await this.prisma.salarySlip.findUnique({
      where: { employeeId_month_year: { employeeId: dto.employeeId, month: dto.month, year: dto.year } },
    });
    if (existing) {
      throw new ConflictException('Salary slip already exists for this month/year');
    }

    const baseSalary = this.money(structure.basic) + this.money(structure.hra) + this.money(structure.allowances);
    const payableDays = await this.payableDays(dto.month, dto.year);
    const reimbursements = await this.approvedReimbursements(dto.employeeId, dto.month, dto.year);
    const deductions = (dto.deductions ?? 0) + this.money(structure.pfDeduction) + this.money(structure.professionalTax) + this.money(structure.tds);
    const incentives = dto.incentives ?? 0;
    const grossSalary = baseSalary + incentives + reimbursements;
    const netPayable = Math.max(grossSalary - deductions, 0);

    const slip = await this.prisma.salarySlip.create({
      data: {
        employeeId: dto.employeeId,
        month: dto.month,
        year: dto.year,
        baseSalary,
        incentives,
        reimbursements,
        grossSalary,
        deductions,
        netPayable,
        lopDays: dto.lopDays ?? 0,
        daysPresent: dto.daysPresent ?? payableDays,
        slipPdfS3Key: this.salarySlipPdfKey(employee.employeeCode, dto.month, dto.year),
        signatureName: dto.signatureName ?? structure.signatureName,
        signatureTitle: dto.signatureTitle ?? structure.signatureTitle,
        notes: dto.notes,
        uploadedBy: adminId,
      },
      include: this.slipInclude,
    });

    await this.notifySlip(employee.id, 'Salary slip generated', `Your ${this.period(dto.month, dto.year)} salary slip is awaiting approval.`, slip.id);
    await this.email.sendSalarySlipStatus(employee.email, this.employeeName(employee), 'GENERATED', this.period(dto.month, dto.year), netPayable, {
      signatureName: slip.signatureName ?? undefined,
    });

    return this.toPlain(slip);
  }

  async approve(adminId: string, id: string) {
    const existing = await this.findSlipOrThrow(id);
    const approver = await this.ensureEmployee(adminId);
    if (existing.status === 'TRANSFERRED') {
      throw new BadRequestException('Transferred salary slips cannot be re-approved');
    }
    const slip = await this.prisma.salarySlip.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: adminId,
        approvedAt: new Date(),
        signatureName: this.employeeName(approver),
        signatureTitle: existing.signatureTitle ?? 'Authorized Payroll Approver',
        signatureAssetKey: this.signatureAssetKey(approver),
        slipPdfS3Key: this.salarySlipPdfKey(existing.employee.employeeCode, existing.month, existing.year),
      },
      include: this.slipInclude,
    });

    await this.notifySlip(slip.employeeId, 'Salary slip approved', `${this.period(slip.month, slip.year)} payroll has been approved.`, slip.id);
    await this.email.sendSalarySlipStatus(slip.employee.email, this.employeeName(slip.employee), 'APPROVED', this.period(slip.month, slip.year), this.money(slip.netPayable), {
      signatureName: slip.signatureName ?? undefined,
    });

    return this.toPlain(slip);
  }

  async markTransferred(id: string, dto: { paymentRef?: string }) {
    const existing = await this.findSlipOrThrow(id);
    if (existing.status !== 'APPROVED' && existing.status !== 'TRANSFERRED') {
      throw new BadRequestException('Approve this salary slip before marking it transferred');
    }
    const slip = await this.prisma.salarySlip.update({
      where: { id },
      data: {
        status: 'TRANSFERRED',
        transferredAt: new Date(),
        paymentRef: dto.paymentRef,
        emailSentAt: new Date(),
      },
      include: this.slipInclude,
    });

    await this.notifySlip(slip.employeeId, 'Salary transferred', `${this.period(slip.month, slip.year)} salary transfer is marked complete.`, slip.id);
    await this.email.sendSalarySlipStatus(slip.employee.email, this.employeeName(slip.employee), 'TRANSFERRED', this.period(slip.month, slip.year), this.money(slip.netPayable), {
      paymentRef: dto.paymentRef,
      signatureName: slip.signatureName ?? undefined,
    });

    return this.toPlain(slip);
  }

  async reject(id: string, dto: { notes?: string }) {
    const existing = await this.findSlipOrThrow(id);
    if (existing.status === 'TRANSFERRED') {
      throw new BadRequestException('Transferred salary slips cannot be rejected');
    }
    const slip = await this.prisma.salarySlip.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes: dto.notes ?? existing.notes,
      },
      include: this.slipInclude,
    });

    await this.notifySlip(slip.employeeId, 'Salary slip rejected', `${this.period(slip.month, slip.year)} payroll was rejected by payroll admin.`, slip.id);
    await this.email.sendSalarySlipStatus(slip.employee.email, this.employeeName(slip.employee), 'REJECTED', this.period(slip.month, slip.year), this.money(slip.netPayable), {
      signatureName: slip.signatureName ?? undefined,
    });

    return this.toPlain(slip);
  }

  async generatePdf(id: string, user: { id: string; role: string }): Promise<Buffer> {
    const slip = await this.findSlipOrThrow(id);
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && slip.employeeId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: false });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const logoPath = path.resolve(process.cwd(), 'assets', 'brand', 'nexgen-logo-full.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 42, 28, { width: 150 });
    }
    doc.fontSize(16).font('Helvetica-Bold').text('NEXGEN PHARMA SOLUTIONS PVT LTD', 210, 36, { align: 'right' });
    doc.fontSize(8).font('Helvetica').text(
      '413 & 420, Prince Cube, Beside Gangotri Exotica\nLaxmipura Char Rasta, Nayaran Garden, 30 Mtr Road, Gotri\nVadodara, Gujarat 390023, India',
      210, 58, { align: 'right' },
    );
    doc.fontSize(10).font('Helvetica').text('Salary Slip', 210, 90, { align: 'right' });
    doc.moveTo(42, 108).lineTo(553, 108).stroke('#1a1a1a');

    doc.fontSize(16).font('Helvetica-Bold').text(this.period(slip.month, slip.year), 42, 128);
    doc.fontSize(10).font('Helvetica').text(`Employee: ${this.employeeName(slip.employee)} (${slip.employee.employeeCode})`, 42, 154);
    doc.text(`Designation: ${slip.employee.designation ?? '-'}`, 42, 170);
    doc.text(`Status: ${slip.status}`, 380, 154);
    doc.text(`Payment Ref: ${slip.paymentRef ?? '-'}`, 380, 170);

    const rows = [
      ['Base Salary', this.money(slip.baseSalary)],
      ['Incentives', this.money(slip.incentives)],
      ['Approved Claims', this.money(slip.reimbursements)],
      ['Gross Salary', this.money(slip.grossSalary)],
      ['Deductions', -this.money(slip.deductions)],
      ['Net Payable', this.money(slip.netPayable)],
    ];

    let y = 218;
    doc.rect(42, y - 24, 511, 24).fill('#1a1a1a');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text('COMPONENT', 54, y - 17).text('AMOUNT', 430, y - 17);
    doc.fillColor('#1a1a1a');
    for (const [label, amount] of rows) {
      doc.rect(42, y, 511, 28).stroke('#1a1a1a');
      doc.font(label === 'Net Payable' ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).text(String(label), 54, y + 9);
      doc.text(this.formatInr(Number(amount)), 430, y + 9, { width: 100, align: 'right' });
      y += 28;
    }

    y += 45;
    doc.font('Helvetica').fontSize(9).text(`Days Present: ${slip.daysPresent}   LOP Days: ${slip.lopDays}`, 42, y);
    doc.text(`Generated Key: ${slip.slipPdfS3Key ?? this.salarySlipPdfKey(slip.employee.employeeCode, slip.month, slip.year)}`, 42, y + 16);

    const signaturePath = slip.signatureAssetKey
      ? path.resolve(process.cwd(), 'assets', slip.signatureAssetKey)
      : undefined;
    if (signaturePath && fs.existsSync(signaturePath)) {
      doc.image(signaturePath, 390, y + 42, { width: 115 });
    }
    doc.moveTo(370, y + 112).lineTo(540, y + 112).stroke('#1a1a1a');
    doc.font('Helvetica-Bold').fontSize(10).text(slip.signatureName ?? 'Authorized Signatory', 370, y + 120, { width: 170, align: 'center' });
    doc.font('Helvetica').fontSize(9).text(slip.signatureTitle ?? 'Payroll Approval', 370, y + 136, { width: 170, align: 'center' });

    doc.fontSize(8).fillColor('#666666').text('This is a system-generated corporate payroll document.', 42, 780, { align: 'center' });
    doc.end();
    return done;
  }

  async findMy(employeeId: string) {
    const rows = await this.prisma.salarySlip.findMany({
      where: { employeeId },
      include: this.slipInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return rows.map((row) => this.toPlain(row));
  }

  async findAll(month?: number, year?: number) {
    const where: Record<string, unknown> = {};
    if (month) where['month'] = month;
    if (year) where['year'] = year;
    const rows = await this.prisma.salarySlip.findMany({
      where,
      include: this.slipInclude,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return rows.map((row) => this.toPlain(row));
  }

  private readonly slipInclude = {
    employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true, designation: true } },
    approver: { select: { firstName: true, lastName: true } },
  } as const;

  private async ensureEmployee(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true, designation: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private async findSlipOrThrow(id: string) {
    const slip = await this.prisma.salarySlip.findUnique({ where: { id }, include: this.slipInclude });
    if (!slip) throw new NotFoundException('Salary slip not found');
    return slip;
  }

  private async approvedReimbursements(employeeId: string, month: number, year: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const sum = await this.prisma.expense.aggregate({
      where: {
        employeeId,
        status: { in: ['APPROVED', 'PAID'] },
        expenseDate: { gte: from, lt: to },
      },
      _sum: { amount: true },
    });
    return this.money(sum._sum.amount);
  }

  private async calculatePayrollDays(
    employeeId: string,
    joiningDate: Date,
    departmentName: string | undefined,
    month: number,
    year: number,
  ): Promise<PayrollDayCounts> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0);
    const [records, holidays] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId, date: { gte: from, lte: to } },
        select: { date: true, status: true },
      }),
      this.prisma.holiday.findMany({
        where: { date: { gte: from, lte: to }, isPaid: true },
        select: { date: true },
      }),
    ]);

    const recordByDate = new Map(records.map((record) => [this.dateKey(record.date), record.status]));
    const paidHolidayKeys = new Set(holidays.map((holiday) => this.dateKey(holiday.date)));
    const counts: PayrollDayCounts = {
      monthDays: to.getDate(),
      workingDays: 0,
      paidDays: 0,
      lopDays: 0,
      presentDays: 0,
      lateDays: 0,
      wfhDays: 0,
      halfDays: 0,
      leaveDays: 0,
      holidayDays: 0,
      weekOffDays: 0,
      absentDays: 0,
      missingPunchDays: 0,
    };

    const softwareWeekOff = departmentName?.toLowerCase().includes('software') ?? false;
    const joinedOn = new Date(joiningDate);
    joinedOn.setHours(0, 0, 0, 0);

    for (let day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
      const current = new Date(day);
      current.setHours(0, 0, 0, 0);
      if (current < joinedOn) {
        counts.absentDays += 1;
        continue;
      }

      const key = this.dateKey(current);
      const isSunday = current.getDay() === 0;
      const isSaturday = current.getDay() === 6;
      const isWeekOff = isSunday || (softwareWeekOff && isSaturday);
      const isPaidHoliday = paidHolidayKeys.has(key);
      const status = recordByDate.get(key);

      if (!isWeekOff && !isPaidHoliday) counts.workingDays += 1;

      if (status === 'PRESENT') {
        counts.presentDays += 1;
        counts.paidDays += 1;
      } else if (status === 'LATE') {
        counts.lateDays += 1;
        counts.paidDays += 1;
      } else if (status === 'WFH') {
        counts.wfhDays += 1;
        counts.paidDays += 1;
      } else if (status === 'HALF_DAY') {
        counts.halfDays += 1;
        counts.paidDays += 0.5;
      } else if (status === 'LEAVE') {
        counts.leaveDays += 1;
        counts.paidDays += 1;
      } else if (status === 'HOLIDAY' || isPaidHoliday) {
        counts.holidayDays += 1;
        counts.paidDays += 1;
      } else if (isWeekOff) {
        counts.weekOffDays += 1;
        counts.paidDays += 1;
      } else if (status === 'MISSING_PUNCH_OUT') {
        counts.missingPunchDays += 1;
      } else {
        counts.absentDays += 1;
      }
    }

    counts.paidDays = this.roundDay(counts.paidDays);
    counts.lopDays = this.roundDay(Math.max(counts.monthDays - counts.paidDays, 0));
    return counts;
  }

  private extractPayrollRows(text: string, documentType: ReconciliationDocumentType): ExtractedPayrollRow[] {
    if (documentType === 'WAGE_SHEET') return this.extractWageSheetRows(text);
    if (documentType === 'EPF_ECR') return this.extractEpfRows(text);
    return this.extractEsicRows(text);
  }

  private extractWageSheetRows(text: string): ExtractedPayrollRow[] {
    const rows: ExtractedPayrollRow[] = [];
    const normalized = text.replace(/\r/g, '\n');
    const linePattern = /^\s*(\d+)\s+(.+?)\s+(\d{12}|NA)\s+([MF])\s+(\d{10}|NA)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/;

    for (const line of normalized.split('\n')) {
      const match = line.trim().match(linePattern);
      if (!match) continue;
      rows.push({
        source: 'WAGE_SHEET',
        name: this.cleanName(match[2]),
        uan: match[3] !== 'NA' ? match[3] : undefined,
        esicIpNumber: match[5] !== 'NA' ? match[5] : undefined,
        paidDays: Number(match[6]),
        grossSalary: Number(match[10]),
        pfDeduction: Number(match[11]),
        esicDeduction: Number(match[12]),
        professionalTax: Number(match[13]),
        deductions: Number(match[14]),
        netPayable: Number(match[15]),
      });
    }
    return rows;
  }

  private extractEpfRows(text: string): ExtractedPayrollRow[] {
    const rows: ExtractedPayrollRow[] = [];
    const pattern = /^\s*\d+\s+(\d{12})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s+\d+(?:\.\d+)?\s*$/;
    for (const line of text.replace(/\r/g, '\n').split('\n')) {
      const match = line.trim().match(pattern);
      if (!match) continue;
      rows.push({
        source: 'EPF_ECR',
        uan: match[1],
        name: this.cleanName(match[2]),
        grossSalary: Number(match[3]),
        pfDeduction: Number(match[4]),
      });
    }
    return rows;
  }

  private extractEsicRows(text: string): ExtractedPayrollRow[] {
    const rows: ExtractedPayrollRow[] = [];
    const pattern = /^\s*\d+\s+-\s+(\d{10})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(?:-|Out of.*)$/;
    for (const line of text.replace(/\r/g, '\n').split('\n')) {
      const match = line.trim().match(pattern);
      if (!match) continue;
      rows.push({
        source: 'ESIC_ECR',
        esicIpNumber: match[1],
        name: this.cleanName(match[2]),
        paidDays: Number(match[3]),
        grossSalary: Number(match[4]),
        esicDeduction: Number(match[5]),
      });
    }
    return rows;
  }

  private matchPayrollRow(
    externalRow: ExtractedPayrollRow,
    payrollRows: Array<{
      employeeId: string;
      paidDays: unknown;
      grossSalary: unknown;
      pfDeduction: unknown;
      esicDeduction: unknown;
      professionalTax: unknown;
      deductions: unknown;
      netPayable: unknown;
      employee: { id: string; firstName: string; lastName: string; employeeCode: string };
    }>,
  ) {
    const externalName = this.normalizeName(externalRow.name);
    return payrollRows.find((row) => {
      const employeeName = this.normalizeName(`${row.employee.firstName} ${row.employee.lastName}`);
      const reversedName = this.normalizeName(`${row.employee.lastName} ${row.employee.firstName}`);
      const code = this.normalizeName(row.employee.employeeCode);
      return (
        employeeName === externalName ||
        reversedName === externalName ||
        employeeName.includes(externalName) ||
        externalName.includes(employeeName) ||
        (code && externalName.includes(code))
      );
    });
  }

  private comparePayrollRows(externalRow: ExtractedPayrollRow, emsRow: Record<string, any>) {
    const differences: string[] = [];
    const compare = (label: string, externalValue: number | undefined, emsValue: unknown, tolerance = 1) => {
      if (externalValue == null || Number.isNaN(externalValue)) return;
      const emsNumber = this.money(emsValue);
      if (Math.abs(externalValue - emsNumber) > tolerance) {
        differences.push(`${label}: external ${externalValue}, EMS ${emsNumber}`);
      }
    };

    compare('Paid days', externalRow.paidDays, emsRow.paidDays, 0.1);
    compare('Gross salary', externalRow.grossSalary, emsRow.grossSalary);
    compare('PF deduction', externalRow.pfDeduction, emsRow.pfDeduction);
    compare('ESIC deduction', externalRow.esicDeduction, emsRow.esicDeduction);
    compare('Professional tax', externalRow.professionalTax, emsRow.professionalTax);
    compare('Total deductions', externalRow.deductions, emsRow.deductions);
    compare('Net payable', externalRow.netPayable, emsRow.netPayable);
    return differences;
  }

  private cleanName(value: string | undefined) {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private normalizeName(value: string | undefined) {
    return this.cleanName(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private async payableDays(month: number, year: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0);
    const holidays = await this.prisma.holiday.findMany({ where: { date: { gte: from, lte: to } } });
    const holidayKeys = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
    let days = 0;
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      const key = d.toISOString().slice(0, 10);
      if (day !== 0 && day !== 6 && !holidayKeys.has(key)) days += 1;
    }
    return days;
  }

  private async notifySlip(employeeId: string, title: string, body: string, referenceId: string) {
    await this.prisma.notification.create({
      data: {
        employeeId,
        title,
        body,
        type: 'SALARY_SLIP',
        referenceId,
        referenceType: 'salary_slip',
      },
    });
  }

  private period(month: number, year: number) {
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  private currentPayrollPeriodInIst(reference = new Date()) {
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'numeric',
      year: 'numeric',
    }).formatToParts(reference);

    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    if (!month || !year) {
      throw new BadRequestException('Could not resolve current payroll period');
    }
    return { month, year };
  }

  private employeeName(employee: { firstName: string; lastName: string }) {
    return `${employee.firstName} ${employee.lastName}`;
  }

  private signatureAssetKey(employee: { firstName: string; lastName: string }) {
    const slug = `${employee.firstName}-${employee.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const known: Record<string, string> = {
      'ashwani-shrivastav': 'signatures/ashwani-shrivastav.png',
      'pratham-shrivastav': 'signatures/pratham-shrivastav.png',
    };
    return known[slug] ?? `signatures/${slug}.png`;
  }

  private salarySlipPdfKey(employeeCode: string, month: number, year: number) {
    return `salary-slips/${year}/${String(month).padStart(2, '0')}/${employeeCode}.pdf`;
  }

  private money(value: unknown) {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value);
    if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
      return value.toNumber() as number;
    }
    return Number(value);
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private roundDay(value: number) {
    return Math.round(value * 100) / 100;
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private formatInr(value: number) {
    const sign = value < 0 ? '-' : '';
    return `${sign}INR ${Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  private toPlain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
