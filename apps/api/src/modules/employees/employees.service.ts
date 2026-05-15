import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

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

    return { employee, tempPassword };
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
}
