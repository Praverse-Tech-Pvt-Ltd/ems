import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

// Validated against the DB constraint — Prisma does not export a LeaveRequest
// status enum; these are the only values the schema accepts.
const VALID_LEAVE_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);

// Annual quota refilled fresh each year — unused days do NOT roll over.
const ANNUAL_LEAVE_QUOTA: { leaveType: 'SL' | 'CL' | 'PL' | 'UL' | 'CO'; totalDays: number }[] = [
  { leaveType: 'SL', totalDays: 7 },
  { leaveType: 'CL', totalDays: 7 },
  { leaveType: 'PL', totalDays: 14 },
  { leaveType: 'UL', totalDays: 0 },
  { leaveType: 'CO', totalDays: 0 },
];

export interface CreateLeaveData {
  leaveType: 'CL' | 'SL' | 'PL' | 'UL' | 'CO';
  fromDate: string;
  toDate: string;
  reason: string;
}

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  async create(employeeId: string, data: CreateLeaveData) {
    const from = new Date(data.fromDate);
    const to = new Date(data.toDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      throw new BadRequestException('Invalid leave date range');
    }

    const leaveDates = await this.getChargeableLeaveDates(employeeId, from, to);
    const totalDays = leaveDates.length;
    if (totalDays === 0) {
      throw new BadRequestException('Selected dates are weekly offs and cannot be applied as leave');
    }

    const currentYear = from.getFullYear();
    const balance = await this.prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveType_year: {
          employeeId,
          leaveType: data.leaveType,
          year: currentYear,
        },
      },
    });

    if (balance && balance.totalDays - balance.usedDays < totalDays && data.leaveType !== 'UL' && data.leaveType !== 'CO') {
      throw new BadRequestException(
        `Insufficient ${data.leaveType} balance. Available: ${balance.totalDays - balance.usedDays} days`,
      );
    }

    return this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveType: data.leaveType,
        fromDate: from,
        toDate: to,
        totalDays,
        reason: data.reason,
        status: 'PENDING',
      },
    });
  }

  async findMy(employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmployee(employeeId: string) {
    const year = new Date().getFullYear();
    const [requests, balances] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: { employeeId },
        include: {
          approver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leaveBalance.findMany({
        where: { employeeId, year },
        orderBy: { leaveType: 'asc' },
      }),
    ]);

    return {
      requests,
      balances,
      summary: {
        submitted: requests.length,
        pending: requests.filter(request => request.status === 'PENDING').length,
        approved: requests.filter(request => request.status === 'APPROVED').length,
        rejected: requests.filter(request => request.status === 'REJECTED').length,
        approvedDays: requests
          .filter(request => request.status === 'APPROVED')
          .reduce((sum, request) => sum + Number(request.totalDays), 0),
      },
    };
  }

  async findAll(status?: string) {
    if (status && !VALID_LEAVE_STATUSES.has(status)) {
      throw new BadRequestException(`Invalid status value: ${status}`);
    }
    const where = status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {};
    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBalance(employeeId: string) {
    const year = new Date().getFullYear();
    return this.prisma.leaveBalance.findMany({
      where: { employeeId, year },
    });
  }

  async approve(id: string, approverId: string, approverRole: string, action: 'approve' | 'reject', rejectionReason?: string) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: { select: { managerId: true } } },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.employeeId === approverId) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }
    if (leave.status !== 'PENDING') {
      throw new BadRequestException(`Leave request is already ${leave.status.toLowerCase()}`);
    }
    if (action === 'reject' && !rejectionReason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const isPrivileged = approverRole === 'ADMIN' || approverRole === 'SUPER_ADMIN';
    if (!isPrivileged) {
      if (leave.employee.managerId !== approverId) {
        throw new ForbiddenException('You are not authorized to approve this leave request');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let approvedTotalDays: number | undefined;

      if (action === 'approve') {
        const year = leave.fromDate.getFullYear();
        const leaveDates = await this.getChargeableLeaveDates(
          leave.employeeId,
          leave.fromDate,
          leave.toDate,
          tx,
        );
        const totalDays = leaveDates.length;
        if (totalDays === 0) {
          throw new BadRequestException('Selected dates are weekly offs and cannot be approved as leave');
        }
        approvedTotalDays = totalDays;

        await tx.leaveBalance.upsert({
          where: {
            employeeId_leaveType_year: {
              employeeId: leave.employeeId,
              leaveType: leave.leaveType,
              year,
            },
          },
          update: { usedDays: { increment: totalDays } },
          create: {
            employeeId: leave.employeeId,
            leaveType: leave.leaveType,
            year,
            totalDays: 0,
            usedDays: totalDays,
          },
        });

        for (const date of leaveDates) {
          await tx.attendanceRecord.upsert({
            where: {
              employeeId_date: {
                employeeId: leave.employeeId,
                date,
              },
            },
            update: {
              status: 'LEAVE',
              punchInTime: null,
              punchOutTime: null,
              workingHours: null,
              isManualPunch: true,
              manualPunchReason: 'Marked leave after approval.',
              isRegularized: true,
              regularizationReason: 'Marked leave after approval.',
            },
            create: {
              employeeId: leave.employeeId,
              date,
              status: 'LEAVE',
              isManualPunch: true,
              manualPunchReason: 'Marked leave after approval.',
              isRegularized: true,
              regularizationReason: 'Marked leave after approval.',
            },
          });
        }
      }

      return tx.leaveRequest.update({
        where: { id },
        data: {
          status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          ...(approvedTotalDays !== undefined ? { totalDays: approvedTotalDays } : {}),
          approvedBy: approverId,
          approvedAt: new Date(),
          rejectionReason: action === 'reject' ? rejectionReason!.trim() : null,
        },
      });
    });
  }

  // Refills every active employee's leave balance for the new year with the
  // standard annual quota — unused days from the previous year are dropped,
  // not carried over (each year gets its own LeaveBalance row, no rollover).
  // Fires at 23:59 on Dec 31 — pre-creates next year's balances so every
  // employee starts the new year freshly refilled with no carried-over days.
  @Cron('59 23 31 12 *', { timeZone: 'Asia/Kolkata' })
  async refillAnnualLeaveBalances() {
    return this.refillLeaveBalancesForYear(new Date().getFullYear() + 1);
  }

  async refillLeaveBalancesForYear(year: number) {
    const employees = await this.prisma.employee.findMany({
      where: { status: { not: 'TERMINATED' } },
      select: { id: true, salaryGrade: true, designation: true },
    });

    let refilled = 0;
    for (const employee of employees) {
      const isIntern =
        employee.salaryGrade === 'INTERN' ||
        employee.designation?.toLowerCase().includes('intern');

      await Promise.all(
        ANNUAL_LEAVE_QUOTA.map(({ leaveType, totalDays }) => {
          const quota = isIntern && leaveType !== 'UL' && leaveType !== 'CO' ? 0 : totalDays;
          return this.prisma.leaveBalance.upsert({
            where: {
              employeeId_leaveType_year: { employeeId: employee.id, leaveType, year },
            },
            create: { employeeId: employee.id, leaveType, year, totalDays: quota, usedDays: 0 },
            update: { totalDays: quota, usedDays: 0 },
          });
        }),
      );
      refilled++;
    }

    return { year, refilled };
  }

  private async getChargeableLeaveDates(
    employeeId: string,
    from: Date,
    to: Date,
    client: Pick<PrismaService, 'employee'> = this.prisma,
  ) {
    const employee = await client.employee.findUnique({
      where: { id: employeeId },
      select: { department: { select: { name: true } } },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const softwareWeekOff = employee.department?.name?.toLowerCase().includes('software') ?? false;
    const dates: Date[] = [];
    const cur = new Date(from);
    cur.setUTCHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setUTCHours(0, 0, 0, 0);

    while (cur <= end) {
      const day = cur.getUTCDay();
      const isWeekOff = day === 0 || (softwareWeekOff && day === 6);
      if (!isWeekOff) dates.push(new Date(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return dates;
  }
}
