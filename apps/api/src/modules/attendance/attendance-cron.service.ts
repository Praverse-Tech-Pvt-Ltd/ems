import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AttendanceService } from './attendance.service';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
  ) {}

  @Cron('0 22 * * *', { name: 'missing-punch-out', timeZone: 'Asia/Kolkata' })
  async flagMissingPunchOuts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const missing = await this.prisma.attendanceRecord.findMany({
      where: {
        date: today,
        punchInTime: { not: null },
        punchOutTime: null,
        status: { not: 'MISSING_PUNCH_OUT' },
      },
      include: { employee: { select: { id: true, firstName: true, email: true } } },
    });

    if (missing.length === 0) return;

    await this.prisma.attendanceRecord.updateMany({
      where: { id: { in: missing.map((r) => r.id) } },
      data: { status: 'MISSING_PUNCH_OUT' },
    });

    await Promise.all(
      missing.map((record) =>
        this.prisma.auditLog.create({
          data: {
            actorId: record.employeeId,
            action: 'MISSING_PUNCH_OUT',
            resourceType: 'attendance',
            resourceId: record.id,
            newValue: {
              status: 'MISSING_PUNCH_OUT',
              date: today.toISOString(),
              message: `Your punch-out was not recorded for ${today.toDateString()}. Please contact admin.`,
            },
          },
        })
      )
    );

    this.logger.log(`Flagged ${missing.length} missing punch-outs`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'Asia/Kolkata' })
  async markAbsences() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // 1. Check if yesterday was a global company holiday
    const isHoliday = await this.prisma.holiday.findFirst({
      where: { date: yesterday },
    });
    if (isHoliday) {
      this.logger.log(`Skipping marking absences for ${yesterday.toDateString()} because it is a holiday: ${isHoliday.title}`);
      return;
    }

    // 2. Fetch all active employees
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    // 3. Find leave requests covering yesterday (APPROVED or PENDING)
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        fromDate: { lte: yesterday },
        toDate: { gte: yesterday },
        status: { in: ['APPROVED', 'PENDING'] },
      },
      select: { employeeId: true },
    });
    const leaveEmployeeIds = new Set(leaves.map((l) => l.employeeId));

    // 4. Get existing attendance records for yesterday
    const existingRecords = await this.prisma.attendanceRecord.findMany({
      where: { date: yesterday },
    });
    const existingRecordsMap = new Map(existingRecords.map((r) => [r.employeeId, r]));

    // 5. Determine which employees are absent
    const recordsToCreate: { employeeId: string; date: Date; status: 'ABSENT' }[] = [];
    const recordIdsToUpdateToAbsent: string[] = [];

    for (const employee of employees) {
      // Skip if the employee has a leave request (sent/approved)
      if (leaveEmployeeIds.has(employee.id)) {
        continue;
      }

      // Skip if yesterday was a week off for this employee
      const weekOff = await this.attendanceService.isWeekOff(employee.id, yesterday);
      if (weekOff) {
        continue;
      }

      const record = existingRecordsMap.get(employee.id);
      if (!record) {
        // No record exists at all -> create ABSENT record
        recordsToCreate.push({
          employeeId: employee.id,
          date: yesterday,
          status: 'ABSENT',
        });
      } else {
        // Record exists, check if punch-in and punch-out are both not done
        if (record.punchInTime === null && record.punchOutTime === null) {
          // Both null -> if status is not already ABSENT (and not LEAVE/HOLIDAY to be safe)
          if (record.status !== 'ABSENT' && record.status !== 'LEAVE' && record.status !== 'HOLIDAY') {
            recordIdsToUpdateToAbsent.push(record.id);
          }
        }
      }
    }

    // 6. Execute db updates
    let createdCount = 0;
    let updatedCount = 0;

    if (recordsToCreate.length > 0) {
      const createRes = await this.prisma.attendanceRecord.createMany({
        data: recordsToCreate,
        skipDuplicates: true,
      });
      createdCount = createRes.count;
    }

    if (recordIdsToUpdateToAbsent.length > 0) {
      const updateRes = await this.prisma.attendanceRecord.updateMany({
        where: { id: { in: recordIdsToUpdateToAbsent } },
        data: { status: 'ABSENT' },
      });
      updatedCount = updateRes.count;
    }

    this.logger.log(
      `Absence processing completed for ${yesterday.toDateString()}. Created: ${createdCount}, Updated to ABSENT: ${updatedCount}`,
    );
  }
}
