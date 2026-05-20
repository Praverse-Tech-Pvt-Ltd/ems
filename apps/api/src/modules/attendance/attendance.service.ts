import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FaceRecognitionService } from './face-recognition.service';
import { GeoFenceService } from './geo-fence.service';
import { PunchInDto } from './dto/punch-in.dto';
import { RegularizeDto } from './dto/regularize.dto';

// ── Attendance Policy Constants ────────────────────────────────────────────────
const HALF_DAY_HOURS = 4;           // < 4 h worked → auto HALF_DAY at punch-out

// Punch-in windows (minutes since midnight)
const PRESENT_CUTOFF   = 9 * 60 + 45;  // ≤ 9:45 → PRESENT
const LATE_CUTOFF      = 10 * 60;       // 9:45–10:00 → LATE (allowance), >10:00 → HALF_DAY
const MAX_LATE_PM      = 4;             // late punch-in allowances per month

// Punch-out early-exit window
const EARLY_OUT_CUTOFF = 17 * 60 + 45; // < 5:45 PM = early exit
const MAX_EARLY_PM     = 4;             // early punch-out allowances per month

// Half-day cap per month
const MAX_HALFDAY_PM   = 4;             // > 4 half-days in a month → LEAVE

// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private fr: FaceRecognitionService,
    private geoFence: GeoFenceService,
  ) {}

  // ── Face verification ──────────────────────────────────────────────────────

  private async verifyFaceOrThrow(employeeId: string, faceImageBase64: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { faceEnrolled: true },
    });

    if (!employee?.faceEnrolled) return;

    const embeddingRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM face_embeddings
      WHERE employee_id = ${employeeId}
    `;
    const count = embeddingRows[0]?.count ?? 0n;

    if (Number(count) === 0) {
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { faceEnrolled: false, faceEnrolledAt: null },
      });
      throw new BadRequestException(
        'Face enrollment is incomplete. Please enroll your face again before punching in.',
      );
    }

    try {
      const result = await this.fr.verify(employeeId, faceImageBase64);
      if (!result.verified) {
        throw new BadRequestException(
          result.reason ?? `Face not recognized (confidence: ${(result.confidence * 100).toFixed(0)}%). Please try again in better lighting.`,
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.warn(`FR service unavailable for ${employeeId}: ${(err as Error).message}`);
      throw new BadRequestException(
        'Face recognition service is offline. Please contact admin to punch in manually.',
      );
    }
  }

  // ── Policy helpers ─────────────────────────────────────────────────────────

  /** Returns the first day of the current month at midnight. */
  private currentMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * Count how many times this employee punched in during the LATE window
   * (9:45–10:00) in the current month.
   */
  private async countLateThisMonth(employeeId: string): Promise<number> {
    return this.prisma.attendanceRecord.count({
      where: {
        employeeId,
        date: { gte: this.currentMonthStart() },
        status: 'LATE',
      },
    });
  }

  /**
   * Count how many times this employee punched out early (before 5:45 PM)
   * in the current month, by fetching records and filtering in JS.
   */
  private async countEarlyPunchOutsThisMonth(employeeId: string): Promise<number> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: this.currentMonthStart() },
        punchOutTime: { not: null },
      },
      select: { punchOutTime: true },
    });
    return records.filter(r => {
      const t = new Date(r.punchOutTime!);
      return this.minutesSinceMidnight(t) < EARLY_OUT_CUTOFF;
    }).length;
  }

  /**
   * Count HALF_DAY records for this employee in the current month,
   * optionally excluding one record by ID (used at punch-out time).
   */
  private async countHalfDaysThisMonth(employeeId: string, excludeId?: string): Promise<number> {
    return this.prisma.attendanceRecord.count({
      where: {
        employeeId,
        date: { gte: this.currentMonthStart() },
        status: 'HALF_DAY',
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  /**
   * If the computed status is HALF_DAY, check whether the employee has
   * already hit the monthly cap; if so, return 'LEAVE' instead.
   */
  private async resolveHalfDay(
    employeeId: string,
    excludeId?: string,
  ): Promise<'HALF_DAY' | 'LEAVE'> {
    const count = await this.countHalfDaysThisMonth(employeeId, excludeId);
    return count >= MAX_HALFDAY_PM ? 'LEAVE' : 'HALF_DAY';
  }

  // ── Punch-in ───────────────────────────────────────────────────────────────

  async punchIn(employeeId: string, dto: PunchInDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const holiday = await this.prisma.holiday.findFirst({ where: { date: today } });
    if (holiday) {
      throw new BadRequestException(`Today is marked as holiday: ${holiday.title}`);
    }

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (existing?.punchInTime) {
      throw new ConflictException('Already punched in today');
    }

    await this.verifyFaceOrThrow(employeeId, dto.faceImageBase64);

    const isGeoValid = await this.geoFence.isWithinAnyOffice(dto.latitude, dto.longitude);
    const now        = new Date();
    const punchMins  = this.minutesSinceMidnight(now);

    // ── Determine punch-in status ────────────────────────────────────────────
    let punchInStatus: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'WFH' | 'LEAVE';

    if (!isGeoValid) {
      // Outside geo-fence: WFH, no time penalty
      punchInStatus = 'WFH';
    } else if (punchMins <= PRESENT_CUTOFF) {
      // ≤ 9:45 AM
      punchInStatus = 'PRESENT';
    } else if (punchMins <= LATE_CUTOFF) {
      // 9:45 – 10:00 AM: check monthly late allowance
      const lateCount = await this.countLateThisMonth(employeeId);
      punchInStatus   = lateCount < MAX_LATE_PM ? 'LATE' : 'HALF_DAY';
    } else {
      // After 10:00 AM: straight HALF_DAY
      punchInStatus = 'HALF_DAY';
    }

    // If HALF_DAY, check monthly cap
    if (punchInStatus === 'HALF_DAY') {
      punchInStatus = await this.resolveHalfDay(employeeId);
    }

    // ── Persist record ───────────────────────────────────────────────────────
    const record = await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      create: {
        employeeId,
        date: today,
        punchInTime: now,
        punchInLat:  dto.latitude,
        punchInLng:  dto.longitude,
        isGeoValidIn: isGeoValid,
        frConfidenceIn: null,
        status: punchInStatus,
        deviceInfo: (dto.deviceInfo ?? {}) as any,
      },
      update: {
        punchInTime: now,
        punchInLat:  dto.latitude,
        punchInLng:  dto.longitude,
        isGeoValidIn: isGeoValid,
        frConfidenceIn: null,
        status: punchInStatus,
      },
    });

    // ── Notifications ────────────────────────────────────────────────────────
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Basic punch-in confirmation
    await this.prisma.notification.create({
      data: {
        employeeId,
        type: 'PUNCH_IN',
        title: 'Punched In',
        body: `You punched in at ${timeStr}`,
        referenceId: record.id,
        referenceType: 'attendance',
      },
    });

    // Policy-specific notifications
    if (punchInStatus === 'LATE') {
      const lateCount = await this.countLateThisMonth(employeeId); // re-count after upsert
      const remaining = MAX_LATE_PM - lateCount;
      await this.prisma.notification.create({
        data: {
          employeeId,
          type: 'GENERAL',
          title: 'Late Punch-In Recorded',
          body: `You punched in at ${timeStr} (late window 9:45–10:00 AM). `
              + `${remaining} late allowance${remaining !== 1 ? 's' : ''} remaining this month.`,
          referenceId: record.id,
          referenceType: 'attendance',
        },
      });
    } else if (punchInStatus === 'HALF_DAY') {
      await this.prisma.notification.create({
        data: {
          employeeId,
          type: 'GENERAL',
          title: 'Half-Day Recorded — Late Arrival',
          body: `Punch-in at ${timeStr} is after 10:00 AM or your 4 late-punch-in allowances for this month are exhausted. Half-day has been marked.`,
          referenceId: record.id,
          referenceType: 'attendance',
        },
      });
    } else if (punchInStatus === 'LEAVE') {
      await this.prisma.notification.create({
        data: {
          employeeId,
          type: 'GENERAL',
          title: 'Leave Recorded — Half-Day Limit Reached',
          body: `You have already used 4 half-days this month. Today has been marked as LEAVE. Please contact HR if this is incorrect.`,
          referenceId: record.id,
          referenceType: 'attendance',
        },
      });
    }

    // Outside geo-fence: notify admins
    if (!isGeoValid) {
      const admins = await this.prisma.employee.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
        select: { id: true },
      });
      const emp = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true },
      });
      const empName  = emp ? `${emp.firstName} ${emp.lastName}` : employeeId;
      const dateLabel = now.toLocaleDateString('en-IN');
      const locLabel  = dto.latitude != null && dto.longitude != null
        ? `GPS: ${Number(dto.latitude).toFixed(5)}, ${Number(dto.longitude).toFixed(5)}`
        : 'GPS: unavailable';

      await Promise.all(admins.map(admin =>
        this.prisma.notification.create({
          data: {
            employeeId: admin.id,
            type: 'GENERAL',
            title: 'Remote Punch-In — Review Required',
            body: `${empName} punched in from outside the office on ${dateLabel}. ${locLabel}. Coordinates stored — review and regularize if needed.`,
            referenceId: record.id,
            referenceType: 'attendance',
          },
        }),
      ));
      await this.prisma.notification.create({
        data: {
          employeeId,
          type: 'GENERAL',
          title: 'Punch-In Recorded — Outside Office',
          body: `Your punch-in was recorded at ${locLabel} outside the office geofence. Admin has been notified and will review.`,
          referenceId: record.id,
          referenceType: 'attendance',
        },
      });
    }

    return record;
  }

  // ── Punch-out ──────────────────────────────────────────────────────────────

  async punchOut(employeeId: string, dto: PunchInDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (!record?.punchInTime) {
      throw new BadRequestException('No punch-in record found for today');
    }
    if (record.punchOutTime) {
      throw new ConflictException('Already punched out today');
    }

    await this.verifyFaceOrThrow(employeeId, dto.faceImageBase64);

    const isGeoValid    = await this.geoFence.isWithinAnyOffice(dto.latitude, dto.longitude);
    const now           = new Date();
    const punchOutMins  = this.minutesSinceMidnight(now);
    const workingHours  = (now.getTime() - record.punchInTime.getTime()) / (1000 * 60 * 60);
    const timeStr       = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // ── Determine final status ───────────────────────────────────────────────
    let finalStatus: string = record.status;     // inherit punch-in status
    let earlyExitWarning    = false;
    let earlyOutRemaining   = 0;

    if (record.status === 'WFH') {
      // WFH punch-outs are never penalised for time
      finalStatus = 'WFH';
    } else if (workingHours < HALF_DAY_HOURS) {
      // Worked less than 4 h regardless of clock time → HALF_DAY
      finalStatus = 'HALF_DAY';
    } else if (punchOutMins < EARLY_OUT_CUTOFF) {
      // Worked ≥ 4 h but punching out before 5:45 PM
      const earlyCount = await this.countEarlyPunchOutsThisMonth(employeeId);
      if (earlyCount >= MAX_EARLY_PM) {
        // Allowances exhausted → HALF_DAY
        finalStatus      = 'HALF_DAY';
        earlyExitWarning = true;
      } else {
        // Within allowance: status stays as punch-in status
        finalStatus      = record.status;
        earlyExitWarning = true;
        earlyOutRemaining = MAX_EARLY_PM - earlyCount - 1; // after this punch-out
      }
    }
    // else: punched out at 5:45 PM or later → keep punch-in status

    // If HALF_DAY, check monthly cap
    if (finalStatus === 'HALF_DAY') {
      finalStatus = await this.resolveHalfDay(employeeId, record.id);
    }

    // ── Persist ──────────────────────────────────────────────────────────────
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        punchOutTime:   now,
        punchOutLat:    dto.latitude,
        punchOutLng:    dto.longitude,
        isGeoValidOut:  isGeoValid,
        frConfidenceOut: null,
        workingHours:   Math.round(workingHours * 100) / 100,
        status:         finalStatus as any,
      },
    });

    // ── Notifications ─────────────────────────────────────────────────────────
    // Basic punch-out confirmation
    await this.prisma.notification.create({
      data: {
        employeeId,
        type: 'PUNCH_OUT',
        title: 'Punched Out',
        body: `You punched out at ${timeStr} · ${workingHours.toFixed(1)} h worked`,
        referenceId: updated.id,
        referenceType: 'attendance',
      },
    });

    // Policy-specific notifications
    if (finalStatus === 'HALF_DAY' && earlyExitWarning) {
      await this.prisma.notification.create({
        data: {
          employeeId,
          type: 'GENERAL',
          title: 'Half-Day Recorded — Early Exit',
          body: `Punch-out at ${timeStr} is before 5:45 PM and your 4 early-exit allowances for this month are exhausted. Half-day has been marked.`,
          referenceId: updated.id,
          referenceType: 'attendance',
        },
      });
    } else if (earlyExitWarning && finalStatus !== 'HALF_DAY' && finalStatus !== 'LEAVE') {
      await this.prisma.notification.create({
        data: {
          employeeId,
          type: 'GENERAL',
          title: 'Early Exit Recorded',
          body: `You punched out early at ${timeStr} (before 5:45 PM). `
              + `${earlyOutRemaining} early-exit allowance${earlyOutRemaining !== 1 ? 's' : ''} remaining this month.`,
          referenceId: updated.id,
          referenceType: 'attendance',
        },
      });
    } else if (finalStatus === 'LEAVE') {
      await this.prisma.notification.create({
        data: {
          employeeId,
          type: 'GENERAL',
          title: 'Leave Recorded — Half-Day Limit Reached',
          body: `You have already used 4 half-days this month. Today has been marked as LEAVE. Please contact HR if this is incorrect.`,
          referenceId: updated.id,
          referenceType: 'attendance',
        },
      });
    }

    // Outside geo-fence: notify admins
    if (!isGeoValid) {
      const adminsOut = await this.prisma.employee.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
        select: { id: true },
      });
      const empOut = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { firstName: true, lastName: true },
      });
      const empNameOut  = empOut ? `${empOut.firstName} ${empOut.lastName}` : employeeId;
      const dateLabelOut = now.toLocaleDateString('en-IN');
      const locLabelOut  = dto.latitude != null && dto.longitude != null
        ? `GPS: ${Number(dto.latitude).toFixed(5)}, ${Number(dto.longitude).toFixed(5)}`
        : 'GPS: unavailable';

      await Promise.all(adminsOut.map(admin =>
        this.prisma.notification.create({
          data: {
            employeeId: admin.id,
            type: 'GENERAL',
            title: 'Remote Punch-Out — Review Required',
            body: `${empNameOut} punched out from outside the office on ${dateLabelOut}. ${locLabelOut}. Coordinates stored — review if needed.`,
            referenceId: updated.id,
            referenceType: 'attendance',
          },
        }),
      ));
      await this.prisma.notification.create({
        data: {
          employeeId,
          type: 'GENERAL',
          title: 'Punch-Out Recorded — Outside Office',
          body: `Your punch-out was recorded at ${locLabelOut} outside the office geofence. Admin has been notified.`,
          referenceId: updated.id,
          referenceType: 'attendance',
        },
      });
    }

    return updated;
  }

  // ── Other methods (unchanged) ─────────────────────────────────────────────

  async getToday(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
  }

  async getByEmployee(
    employeeId: string,
    from?: string,
    to?: string,
    limit?: number,
  ) {
    const where: Record<string, unknown> = { employeeId };
    if (from || to) {
      where['date'] = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }
    return this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: 'desc' },
      ...(limit ? { take: limit } : {}),
    });
  }

  async getAll(from?: string, to?: string, status?: string) {
    const where: Record<string, unknown> = {};
    if (from || to) {
      where['date'] = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }
    if (status) where['status'] = status;

    return this.prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: [{ date: 'desc' }, { punchInTime: 'asc' }],
    });
  }

  async regularize(id: string, adminId: string, dto: RegularizeDto) {
    const record = await this.prisma.attendanceRecord.findUniqueOrThrow({ where: { id } });

    const updated = await this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        punchInTime:  dto.punchInTime  ? new Date(dto.punchInTime)  : record.punchInTime,
        punchOutTime: dto.punchOutTime ? new Date(dto.punchOutTime) : record.punchOutTime,
        status: dto.status ?? record.status,
        isRegularized: true,
        regularizedBy: adminId,
        regularizationReason: dto.reason,
        workingHours: dto.punchInTime && dto.punchOutTime
          ? Math.round(
              (new Date(dto.punchOutTime).getTime() - new Date(dto.punchInTime).getTime()) /
                (1000 * 60 * 60) * 100,
            ) / 100
          : record.workingHours,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId:      adminId,
        action:       'REGULARIZE',
        resourceType: 'attendance',
        resourceId:   id,
        oldValue:     record as object,
        newValue:     updated as object,
      },
    });

    return updated;
  }

  async getMyStats(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const holidays = await this.prisma.holiday.findMany({
      where: { date: { gte: monthStart, lte: today } },
      select: { date: true },
    });
    const holidaySet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    let totalWorkingDays = 0;
    const cur = new Date(monthStart);
    while (cur <= today) {
      const dow = cur.getDay();
      const ds  = cur.toISOString().split('T')[0];
      if (dow !== 0 && dow !== 6 && !holidaySet.has(ds)) totalWorkingDays++;
      cur.setDate(cur.getDate() + 1);
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: { employeeId, date: { gte: monthStart, lte: today } },
      select: { status: true },
    });

    let daysPresent = 0, daysHalfDay = 0, daysOnLeave = 0, daysAbsent = 0;
    for (const r of records) {
      if      (r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'WFH') daysPresent++;
      else if (r.status === 'HALF_DAY') daysHalfDay++;
      else if (r.status === 'LEAVE')    daysOnLeave++;
      else if (r.status === 'ABSENT')   daysAbsent++;
    }

    const attendedDays      = daysPresent + daysHalfDay * 0.5 + daysOnLeave;
    const attendancePercent = totalWorkingDays > 0
      ? Math.round((attendedDays / totalWorkingDays) * 100)
      : 0;

    const monthName = today.toLocaleString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase();
    return {
      month: monthName,
      totalWorkingDays,
      daysPresent,
      daysHalfDay,
      daysOnLeave,
      daysAbsent,
      attendedDays,
      attendancePercent,
    };
  }

  /** Returns a summary of the employee's monthly policy usage. */
  async getPolicyUsage(employeeId: string) {
    const [lateCount, earlyCount, halfDayCount] = await Promise.all([
      this.countLateThisMonth(employeeId),
      this.countEarlyPunchOutsThisMonth(employeeId),
      this.countHalfDaysThisMonth(employeeId),
    ]);
    return {
      latePunchIns:          { used: lateCount,    allowed: MAX_LATE_PM,     remaining: Math.max(0, MAX_LATE_PM - lateCount) },
      earlyPunchOuts:        { used: earlyCount,   allowed: MAX_EARLY_PM,    remaining: Math.max(0, MAX_EARLY_PM - earlyCount) },
      halfDays:              { used: halfDayCount, allowed: MAX_HALFDAY_PM,  remaining: Math.max(0, MAX_HALFDAY_PM - halfDayCount) },
      policy: {
        presentCutoff:   '09:45',
        lateCutoff:      '10:00',
        earlyOutCutoff:  '17:45',
        regularPunchOut: '18:00',
      },
    };
  }

  async resetFace(employeeId: string) {
    try { await this.fr.deleteFace(employeeId); } catch { /* FR may be offline */ }
    await this.prisma.$executeRaw`
      DELETE FROM face_embeddings WHERE employee_id = ${employeeId}
    `;
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { faceEnrolled: false, faceEnrolledAt: null },
    });
    return { message: 'Face data reset. Please re-enroll on next login.' };
  }

  async enrollFace(employeeId: string, frames: string[]) {
    if (!frames.length) {
      throw new BadRequestException('No frames provided for enrollment');
    }
    try {
      await this.fr.enroll(employeeId, frames);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      throw new BadRequestException(
        msg || 'Face enrollment failed. Please make sure the face service is running and retry.',
      );
    }

    const embeddingRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM face_embeddings WHERE employee_id = ${employeeId}
    `;
    const count = embeddingRows[0]?.count ?? 0n;

    if (Number(count) === 0) {
      throw new BadRequestException(
        'Face enrollment did not save a biometric template. Please retry.',
      );
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { faceEnrolled: true, faceEnrolledAt: new Date() },
    });
    return { message: 'Face enrolled successfully.' };
  }

  private minutesSinceMidnight(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }
}
