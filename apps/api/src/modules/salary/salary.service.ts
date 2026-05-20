import { BadRequestException, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
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
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, email: true, designation: true } },
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

  async generatePdf(id: string): Promise<Buffer> {
    const slip = await this.findSlipOrThrow(id);
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

  private formatInr(value: number) {
    const sign = value < 0 ? '-' : '';
    return `${sign}INR ${Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }

  private toPlain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
