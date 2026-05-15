import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

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
  constructor(private prisma: PrismaService) {}

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
      data: { ...data, uploadedBy },
    });
  }

  async findMy(employeeId: string) {
    return this.prisma.salarySlip.findMany({
      where: { employeeId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async findAll(month?: number, year?: number) {
    const where: Record<string, unknown> = {};
    if (month) where['month'] = month;
    if (year) where['year'] = year;
    return this.prisma.salarySlip.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }
}
