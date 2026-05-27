import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AttendanceCronService {
  private readonly logger = new Logger(AttendanceCronService.name);

  constructor(private prisma: PrismaService) {}

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

    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    const existingRecords = await this.prisma.attendanceRecord.findMany({
      where: { date: yesterday },
      select: { employeeId: true },
    });

    const presentIds = new Set(existingRecords.map((r) => r.employeeId));
    const absentEmployees = employees.filter((e) => !presentIds.has(e.id));

    if (absentEmployees.length === 0) return;

    await this.prisma.attendanceRecord.createMany({
      data: absentEmployees.map((e) => ({
        employeeId: e.id,
        date: yesterday,
        status: 'ABSENT' as const,
      })),
      skipDuplicates: true,
    });

    this.logger.log(`Marked ${absentEmployees.length} employees absent for ${yesterday.toDateString()}`);
  }
}
