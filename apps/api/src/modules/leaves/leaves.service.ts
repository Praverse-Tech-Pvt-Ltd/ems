import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// Validated against the DB constraint — Prisma does not export a LeaveRequest
// status enum; these are the only values the schema accepts.
const VALID_LEAVE_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);

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
    const totalDays =
      Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const currentYear = new Date().getFullYear();
    const balance = await this.prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveType_year: {
          employeeId,
          leaveType: data.leaveType,
          year: currentYear,
        },
      },
    });

    if (balance && balance.totalDays - balance.usedDays < totalDays && data.leaveType !== 'UL') {
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

  async approve(id: string, approverId: string, action: 'approve' | 'reject', rejectionReason?: string) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.employeeId === approverId) {
      throw new ForbiddenException('You cannot approve your own leave request');
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectionReason: action === 'reject' ? rejectionReason : null,
      },
    });

    if (action === 'approve') {
      const year = leave.fromDate.getFullYear();
      await this.prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveType_year: {
            employeeId: leave.employeeId,
            leaveType: leave.leaveType,
            year,
          },
        },
        update: { usedDays: { increment: leave.totalDays } },
        create: {
          employeeId: leave.employeeId,
          leaveType: leave.leaveType,
          year,
          totalDays: 0,
          usedDays: leave.totalDays,
        },
      });

      const dates: Date[] = [];
      const cur = new Date(leave.fromDate);
      while (cur <= leave.toDate) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }

      await this.prisma.attendanceRecord.createMany({
        data: dates.map((d) => ({
          employeeId: leave.employeeId,
          date: d,
          status: 'LEAVE' as const,
        })),
        skipDuplicates: true,
      });
    }

    return updated;
  }
}
