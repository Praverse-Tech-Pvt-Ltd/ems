import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async attendanceSummary(from: string, to: string, employeeId?: string) {
    const where: Record<string, unknown> = {
      date: { gte: new Date(from), lte: new Date(to) },
    };
    if (employeeId) where['employeeId'] = employeeId;

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } },
      },
    });

    return records;
  }

  async expenseSummary(from: string, to: string) {
    return this.prisma.expense.groupBy({
      by: ['category', 'status'],
      where: { expenseDate: { gte: new Date(from), lte: new Date(to) } },
      _sum: { amount: true },
      _count: true,
    });
  }

  async payrollSummary(month: number, year: number) {
    return this.prisma.salarySlip.findMany({
      where: { month, year },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
      },
    });
  }

  async dashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalEmployees,
      presentToday,
      pendingExpenses,
      pendingLeaves,
      overdueInvoices,
      missingPunchOuts,
    ] = await Promise.all([
      this.prisma.employee.count({ where: { status: 'ACTIVE' } }),
      this.prisma.attendanceRecord.count({ where: { date: today, status: { in: ['PRESENT', 'LATE', 'WFH'] } } }),
      this.prisma.expense.count({ where: { status: { in: ['SUBMITTED', 'L1_REVIEW', 'FINANCE_REVIEW'] } } }),
      this.prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.invoice.count({ where: { status: 'OVERDUE' } }),
      this.prisma.attendanceRecord.count({ where: { date: today, status: 'MISSING_PUNCH_OUT' } }),
    ]);

    return {
      totalEmployees,
      presentToday,
      absentToday: totalEmployees - presentToday,
      pendingExpenses,
      pendingLeaves,
      overdueInvoices,
      missingPunchOuts,
    };
  }
}
