import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface MonthlyAttendanceBalanceCounts {
  employeeId: string;
  month: number;
  year: number;
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
  designatedHours: number;
  actualHours: number;
  grossOvertimeHours: number;
  grossShortfallHours: number;
  overtimeCreditHours: number;
  balancedHours: number;
  netOvertimeHours: number;
  netShortfallHours: number;
  overtimeBalanceFactor: number;
  lateAllowanceMonthly: number;
  lateAllowanceUsed: number;
  lateConvertedToHalfDay: number;
}

export const MONTHLY_LATE_ALLOWANCE = 2;
export const OVERTIME_BALANCE_FACTOR = 0.5;
export const DESIGNATED_HOURS_PER_WORKING_DAY = 8.5;

@Injectable()
export class AttendanceBalanceService {
  constructor(private prisma: PrismaService) {}

  async calculateEmployeeMonth(employeeId: string, month: number, year: number): Promise<MonthlyAttendanceBalanceCounts> {
    this.assertMonthYear(month, year);

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        joiningDate: true,
        department: { select: { name: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0);
    const [records, holidays] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId, date: { gte: from, lte: to } },
        select: {
          date: true,
          status: true,
          punchInTime: true,
          punchOutTime: true,
          workingHours: true,
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.holiday.findMany({
        where: { date: { gte: from, lte: to }, isPaid: true },
        select: { date: true },
      }),
    ]);

    const recordByDate = new Map(records.map((record) => [this.dateKey(record.date), record]));
    const paidHolidayKeys = new Set(holidays.map((holiday) => this.dateKey(holiday.date)));
    const counts: MonthlyAttendanceBalanceCounts = {
      employeeId,
      month,
      year,
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
      designatedHours: 0,
      actualHours: 0,
      grossOvertimeHours: 0,
      grossShortfallHours: 0,
      overtimeCreditHours: 0,
      balancedHours: 0,
      netOvertimeHours: 0,
      netShortfallHours: 0,
      overtimeBalanceFactor: OVERTIME_BALANCE_FACTOR,
      lateAllowanceMonthly: MONTHLY_LATE_ALLOWANCE,
      lateAllowanceUsed: 0,
      lateConvertedToHalfDay: 0,
    };

    const softwareWeekOff = employee.department?.name?.toLowerCase().includes('software') ?? false;
    const joinedOn = new Date(employee.joiningDate);
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
      const record = recordByDate.get(key);
      const status = record?.status;

      if (!isWeekOff && !isPaidHoliday) {
        counts.workingDays += 1;
        counts.designatedHours += DESIGNATED_HOURS_PER_WORKING_DAY;
        this.applyMonthlyHoursBalance(counts, status, this.attendanceHours(record));
      }

      if (status === 'PRESENT') {
        counts.presentDays += 1;
        counts.paidDays += 1;
      } else if (status === 'LATE') {
        if (counts.lateAllowanceUsed < MONTHLY_LATE_ALLOWANCE) {
          counts.lateDays += 1;
          counts.lateAllowanceUsed += 1;
          counts.paidDays += 1;
        } else {
          counts.halfDays += 1;
          counts.lateConvertedToHalfDay += 1;
          counts.paidDays += 0.5;
        }
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

    counts.paidDays = this.round(counts.paidDays);
    counts.lopDays = this.round(Math.max(counts.monthDays - counts.paidDays, 0));
    counts.designatedHours = this.round(counts.designatedHours);
    counts.actualHours = this.round(counts.actualHours);
    counts.grossOvertimeHours = this.round(counts.grossOvertimeHours);
    counts.grossShortfallHours = this.round(counts.grossShortfallHours);
    counts.overtimeCreditHours = this.round(counts.grossOvertimeHours * OVERTIME_BALANCE_FACTOR);
    counts.balancedHours = this.round(Math.min(counts.overtimeCreditHours, counts.grossShortfallHours));
    counts.netOvertimeHours = this.round(Math.max(counts.overtimeCreditHours - counts.balancedHours, 0));
    counts.netShortfallHours = this.round(Math.max(counts.grossShortfallHours - counts.balancedHours, 0));

    return counts;
  }

  async upsertEmployeeMonth(employeeId: string, month: number, year: number, calculatedBy?: string) {
    const counts = await this.calculateEmployeeMonth(employeeId, month, year);
    return this.upsertCounts(counts, calculatedBy);
  }

  async upsertCounts(counts: MonthlyAttendanceBalanceCounts, calculatedBy?: string) {
    const { employeeId, month, year } = counts;
    return this.prisma.monthlyAttendanceBalance.upsert({
      where: { employeeId_month_year: { employeeId, month, year } },
      update: {
        ...this.toPersistence(counts),
        calculatedBy,
        calculatedAt: new Date(),
      },
      create: {
        ...this.toPersistence(counts),
        calculatedBy,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });
  }

  async recalculateMonth(adminId: string, dto: { month: number; year: number; employeeId?: string }) {
    this.assertMonthYear(dto.month, dto.year);
    const employees = await this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        ...(dto.employeeId ? { id: dto.employeeId } : {}),
      },
      select: { id: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    if (dto.employeeId && employees.length === 0) {
      throw new NotFoundException('Employee not found');
    }

    const rows = [];
    for (const employee of employees) {
      rows.push(await this.upsertEmployeeMonth(employee.id, dto.month, dto.year, adminId));
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'MONTHLY_ATTENDANCE_BALANCE_RECALCULATED',
        resourceType: 'monthly_attendance_balance',
        resourceId: dto.employeeId ?? `${dto.year}-${String(dto.month).padStart(2, '0')}`,
        newValue: { month: dto.month, year: dto.year, employeeId: dto.employeeId, rows: rows.length },
      },
    });

    return {
      month: dto.month,
      year: dto.year,
      employees: rows.length,
      rows,
    };
  }

  list(month: number, year: number, employeeId?: string) {
    this.assertMonthYear(month, year);
    return this.prisma.monthlyAttendanceBalance.findMany({
      where: {
        month,
        year,
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: [{ employee: { firstName: 'asc' } }, { employee: { lastName: 'asc' } }],
    });
  }

  private toPersistence(counts: MonthlyAttendanceBalanceCounts) {
    return {
      employeeId: counts.employeeId,
      month: counts.month,
      year: counts.year,
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
      designatedHours: counts.designatedHours,
      actualHours: counts.actualHours,
      grossOvertimeHours: counts.grossOvertimeHours,
      grossShortfallHours: counts.grossShortfallHours,
      overtimeCreditHours: counts.overtimeCreditHours,
      balancedHours: counts.balancedHours,
      netOvertimeHours: counts.netOvertimeHours,
      netShortfallHours: counts.netShortfallHours,
      overtimeBalanceFactor: counts.overtimeBalanceFactor,
      lateAllowanceMonthly: counts.lateAllowanceMonthly,
      lateAllowanceUsed: counts.lateAllowanceUsed,
      lateConvertedToHalfDay: counts.lateConvertedToHalfDay,
    };
  }

  private attendanceHours(record?: { workingHours: unknown; punchInTime: Date | null; punchOutTime: Date | null }) {
    const recordedHours = this.money(record?.workingHours);
    if (recordedHours > 0) return recordedHours;
    if (!record?.punchInTime || !record.punchOutTime) return 0;
    const hours = (record.punchOutTime.getTime() - record.punchInTime.getTime()) / (1000 * 60 * 60);
    return Math.max(this.round(hours), 0);
  }

  private applyMonthlyHoursBalance(
    counts: MonthlyAttendanceBalanceCounts,
    status: AttendanceStatus | undefined,
    actualHours: number,
  ) {
    if (status === 'LEAVE' || status === 'HOLIDAY') return;

    counts.actualHours += actualHours;
    const delta = actualHours - DESIGNATED_HOURS_PER_WORKING_DAY;
    if (delta > 0) {
      counts.grossOvertimeHours += delta;
    } else {
      counts.grossShortfallHours += Math.abs(delta);
    }
  }

  private assertMonthYear(month: number, year: number) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('Month must be between 1 and 12');
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('Year must be between 2000 and 2100');
    }
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

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
