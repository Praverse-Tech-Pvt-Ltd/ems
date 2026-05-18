import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { StorageService } from '../../common/storage/storage.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SubmitMyDocumentDto, UpdateMyBankDetailsDto } from './dto/onboarding.dto';

const EMPLOYEE_SELECT = {
  id: true,
  employeeCode: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  designation: true,
  role: true,
  departmentId: true,
  department: { select: { id: true, name: true } },
  managerId: true,
  manager: { select: { id: true, firstName: true, lastName: true } },
  joiningDate: true,
  profilePhotoUrl: true,
  faceEnrolled: true,
  status: true,
  createdAt: true,
} as const;

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private storage: StorageService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const count = await this.prisma.employee.count();
    const employeeCode = `NXG-${String(count + 1).padStart(3, '0')}`;
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const employee = await this.prisma.employee.create({
      data: {
        ...dto,
        employeeCode,
        passwordHash,
        joiningDate: new Date(dto.joiningDate),
      },
      select: EMPLOYEE_SELECT,
    });

    await this.email.sendWelcome(
      employee.email,
      `${employee.firstName} ${employee.lastName}`,
      tempPassword,
    );

    await this.seedLeaveBalances(employee.id);

    return { employee, tempPassword };
  }

  async seedAllLeaveBalances() {
    const employees = await this.prisma.employee.findMany({ select: { id: true } });
    await Promise.all(employees.map(e => this.seedLeaveBalances(e.id)));
    return { seeded: employees.length };
  }

  async seedLeaveBalances(employeeId: string) {
    const year = new Date().getFullYear();
    const allocations: { leaveType: string; totalDays: number }[] = [
      { leaveType: 'SL', totalDays: 7 },
      { leaveType: 'CL', totalDays: 7 },
      { leaveType: 'PL', totalDays: 14 },
    ];
    await Promise.all(
      allocations.map(a =>
        this.prisma.leaveBalance.upsert({
          where: {
            employeeId_leaveType_year: { employeeId, leaveType: a.leaveType as never, year },
          },
          create: { employeeId, leaveType: a.leaveType as never, year, totalDays: a.totalDays, usedDays: 0 },
          update: { totalDays: a.totalDays },
        }),
      ),
    );
  }

  async findAll(query: { search?: string; departmentId?: string; role?: string }) {
    const where: Record<string, unknown> = { status: { not: 'TERMINATED' } };

    if (query.search) {
      where['OR'] = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.departmentId) where['departmentId'] = query.departmentId;
    if (query.role) where['role'] = query.role;

    return this.prisma.employee.findMany({ where, select: EMPLOYEE_SELECT });
  }

  async findColleagues() {
    return this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        employeeCode: true,
        email: true,
        firstName: true,
        lastName: true,
        designation: true,
        role: true,
        status: true,
        joiningDate: true,
        faceEnrolled: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: EMPLOYEE_SELECT,
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: dto,
      select: EMPLOYEE_SELECT,
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.employee.update({
      where: { id },
      data: { status: 'TERMINATED' },
      select: EMPLOYEE_SELECT,
    });
  }

  async getMyOnboarding(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        bankAccountEnc: true,
        panEnc: true,
        aadhaarLast4: true,
        profilePhotoUrl: true,
        faceEnrolled: true,
        documents: {
          select: { id: true, docType: true, fileS3Key: true, status: true, rejectionReason: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const latestDocs = new Map(employee.documents.map((doc) => [doc.docType, doc]));
    const requirements = [
      { key: 'BANK', label: 'Bank details', complete: !!employee.bankAccountEnc },
      { key: 'AADHAAR', label: 'Aadhaar card', complete: latestDocs.get('AADHAAR')?.status === 'VERIFIED' && !!employee.aadhaarLast4 },
      { key: 'PAN', label: 'PAN card', complete: latestDocs.get('PAN')?.status === 'VERIFIED' && !!employee.panEnc },
      { key: 'PHOTO', label: 'Photograph', complete: latestDocs.get('PHOTO')?.status === 'VERIFIED' || !!employee.profilePhotoUrl },
      { key: 'FACE_CAPTURE', label: 'Face recognition capture', complete: employee.faceEnrolled },
    ];

    return {
      bankDetailsSubmitted: !!employee.bankAccountEnc,
      panSubmitted: !!employee.panEnc,
      aadhaarSubmitted: !!employee.aadhaarLast4,
      profilePhotoSubmitted: !!employee.profilePhotoUrl || latestDocs.has('PHOTO'),
      faceEnrolled: employee.faceEnrolled,
      completionPercent: Math.round((requirements.filter((item) => item.complete).length / requirements.length) * 100),
      requirements,
      documents: [...latestDocs.values()],
    };
  }

  async updateMyBankDetails(id: string, dto: UpdateMyBankDetailsDto) {
    await this.findOne(id);
    const payload = {
      bankName: dto.bankName,
      accountNumber: dto.accountNumber,
      ifsc: dto.ifsc,
      accountHolderName: dto.accountHolderName,
    };
    await this.prisma.employee.update({
      where: { id },
      data: {
        bankAccountEnc: this.encodeSensitive(JSON.stringify(payload)),
        panEnc: dto.panNumber ? this.encodeSensitive(dto.panNumber.toUpperCase()) : undefined,
        aadhaarLast4: dto.aadhaarLast4,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: id,
        action: 'BANK_DETAILS_UPDATED',
        resourceType: 'employee',
        resourceId: id,
        newValue: { bankName: dto.bankName, ifsc: dto.ifsc, panSubmitted: !!dto.panNumber, aadhaarLast4: dto.aadhaarLast4 },
      },
    });
    return this.getMyOnboarding(id);
  }

  async submitMyDocument(id: string, dto: SubmitMyDocumentDto) {
    await this.findOne(id);
    const doc = await this.prisma.employeeDocument.create({
      data: {
        employeeId: id,
        docType: dto.docType,
        fileS3Key: dto.fileS3Key,
        uploadedBy: id,
      },
    });
    if (dto.docType === 'PHOTO') {
      await this.prisma.employee.update({
        where: { id },
        data: { profilePhotoUrl: dto.fileS3Key },
      });
    }
    if (dto.docType === 'FACE_CAPTURE') {
      await this.prisma.employee.update({
        where: { id },
        data: { faceEnrolled: true, faceVectorS3Key: dto.fileS3Key },
      });
    }
    return { document: doc, onboarding: await this.getMyOnboarding(id) };
  }

  async uploadMyDocument(id: string, docType: string, file: Express.Multer.File) {
    if (!file) throw new NotFoundException('Document file not found');
    const employee = await this.findOne(id);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const key = `employee-documents/${employee.employeeCode}/${docType.toLowerCase()}-${Date.now()}-${safeName}`;
    const storedKey = await this.storage.uploadBuffer(key, file.buffer, file.mimetype);
    return this.submitMyDocument(id, { docType, fileS3Key: storedKey });
  }

  private encodeSensitive(value: string) {
    const key = crypto.createHash('sha256').update(this.config.get<string>('ENCRYPTION_KEY') ?? 'dev').digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  async listDocumentsForReview() {
    return this.prisma.employeeDocument.findMany({
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewDocument(adminId: string, id: string, data: { status: 'VERIFIED' | 'REJECTED'; rejectionReason?: string }) {
    const old = await this.prisma.employeeDocument.findUniqueOrThrow({ where: { id } });
    const updated = await this.prisma.employeeDocument.update({
      where: { id },
      data: {
        status: data.status,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: data.status === 'REJECTED' ? data.rejectionReason : null,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: `DOCUMENT_${data.status}`,
        resourceType: 'employee_document',
        resourceId: id,
        oldValue: old as object,
        newValue: updated as object,
      },
    });
    await this.prisma.notification.create({
      data: {
        employeeId: updated.employeeId,
        type: 'GENERAL',
        title: data.status === 'VERIFIED' ? 'Document verified' : 'Document rejected',
        body: `${updated.docType} ${data.status.toLowerCase()}${data.rejectionReason ? `: ${data.rejectionReason}` : ''}`,
        referenceId: updated.id,
        referenceType: 'employee_document',
      },
    });
    return updated;
  }
}
