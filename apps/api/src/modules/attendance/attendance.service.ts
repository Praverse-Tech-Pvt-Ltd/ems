import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

import { GeoFenceService } from './geo-fence.service';
import { PunchInDto } from './dto/punch-in.dto';
import { RegularizeDto } from './dto/regularize.dto';
import { OdPunchInDto, OdPunchOutDto } from './dto/od-punch.dto';
import { AdminUpsertAttendanceDto } from './dto/admin-upsert.dto';
import { EditTimeDto } from './dto/edit-time.dto';
import { UpdateAttendancePolicyDto } from './dto/update-attendance-policy.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ATTENDANCE_BLOCKED_MESSAGE, isAttendanceBlockedIdentity } from './attendance-blocklist';

// ── Attendance Policy Constants ────────────────────────────────────────────────
const HALF_DAY_HOURS = 4;           // < 4 h worked → auto HALF_DAY at punch-out
const HALF_DAY_PUNCH_IN_CUTOFF = 12 * 60;

// Monthly allowance caps (late arrivals, early punch-outs, half-days) live in
// the AttendancePolicy table — see getPolicyLimits() — and are admin
// configurable via GET/PATCH /attendance/admin/policy.
const ATTENDANCE_TIME_ZONE = 'Asia/Kolkata';

// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private geoFence: GeoFenceService,
    private notifications: NotificationsGateway,
  ) {}



  private getISTToday(): Date {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + (3600000 * 5.5));
    return new Date(Date.UTC(ist.getFullYear(), ist.getMonth(), ist.getDate()));
  }

  private getISTDateFor(date: Date): Date {
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const ist = new Date(utc + (3600000 * 5.5));
    return new Date(Date.UTC(ist.getFullYear(), ist.getMonth(), ist.getDate()));
  }

  /**
   * Pushes a live attendance change both to the affected employee's own
   * room and to the shared 'admins' room, so an admin watching a team-wide
   * view (e.g. "Team Today") sees it without a manual reload too.
   *
   * Best-effort only: a notification failure must never surface as a
   * failure of the attendance action itself, which has already been
   * committed to the database by the time this runs.
   */
  private emitAttendanceUpdated(
    employeeId: string,
    payload: { date: string; status: string; punchInTime: Date | null; punchOutTime: Date | null },
  ): void {
    try {
      this.notifications.sendToEmployee(employeeId, 'attendance:updated', payload);
      this.notifications.broadcastToAdmins('attendance:updated', { employeeId, ...payload });
    } catch (err) {
      this.logger.warn(`Failed to push attendance:updated for employee ${employeeId}: ${err}`);
    }
  }

  private calculateWorkingHours(punchInTime: Date, punchOutTime: Date): number {
    return Math.round(
      ((punchOutTime.getTime() - punchInTime.getTime()) / (1000 * 60 * 60)) * 100,
    ) / 100;
  }

  private async assertAttendanceAllowed(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (isAttendanceBlockedIdentity(employee)) {
      throw new ForbiddenException(ATTENDANCE_BLOCKED_MESSAGE);
    }
  }

  private async assertAttendanceRecordAllowed(attendanceId: string) {
    const record = await this.prisma.attendanceRecord.findUniqueOrThrow({
      where: { id: attendanceId },
      include: {
        employee: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    if (isAttendanceBlockedIdentity(record.employee)) {
      throw new ForbiddenException(ATTENDANCE_BLOCKED_MESSAGE);
    }
    return record;
  }

  /** Returns true if today is a non-working day for this employee.
   *  Software Development dept: Saturday + Sunday off.
   *  All others: Sunday only.
   */
  async isWeekOff(employeeId: string, date?: Date): Promise<boolean> {
    const d = date ?? this.getISTToday();
    const day = d.getDay(); // 0=Sun, 6=Sat
    if (day === 0) return true; // Everyone off on Sunday
    if (day !== 6) return false; // Mon-Fri: never a week-off
    // Saturday: only off for Software Development
    const emp = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { department: { select: { name: true } } },
    });
    return emp?.department?.name?.toLowerCase().includes('software') ?? false;
  }

  private formatMinutes(mins: number): string {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Shift timing is per-employee, stored on Employee.shiftStartMinutes /
   * shiftEndMinutes. An employee without an individually configured shift
   * falls back to the company-default shift (09:30-18:00).
   */
  private async getEmployeeTimeConstraints(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { shiftStartMinutes: true, shiftEndMinutes: true },
    });

    const DEFAULT_SHIFT_START = 9 * 60 + 30; // 09:30
    const DEFAULT_SHIFT_END = 18 * 60;       // 18:00

    const designatedStart = employee?.shiftStartMinutes ?? DEFAULT_SHIFT_START;
    const designatedEnd   = employee?.shiftEndMinutes   ?? DEFAULT_SHIFT_END;
    const lateCutoff = designatedStart + 30;
    const earlyOutCutoff = designatedEnd - 30;

    return {
      DESIGNATED_START: designatedStart,
      DESIGNATED_END: designatedEnd,
      LATE_CUTOFF: lateCutoff,
      EARLY_OUT_CUTOFF: earlyOutCutoff,
      policyText: {
        presentCutoff:   this.formatMinutes(designatedStart),
        lateCutoff:      this.formatMinutes(lateCutoff),
        earlyOutCutoff:  this.formatMinutes(earlyOutCutoff),
        regularPunchOut: this.formatMinutes(designatedEnd),
      },
    };
  }

  // ── Policy helpers ─────────────────────────────────────────────────────────

  /** Returns the first day of the current month at midnight. */
  private currentMonthStart(): Date {
    const today = this.getISTToday();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
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
    const { EARLY_OUT_CUTOFF } = await this.getEmployeeTimeConstraints(employeeId);
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
   * Company-wide monthly attendance allowances. Stored as a single row in
   * AttendancePolicy (id 'default'); upserted on first read so the service
   * works even before a seed/migration has inserted the row.
   */
  private async getPolicyLimits() {
    const policy = await this.prisma.attendancePolicy.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    return {
      maxLatePerMonth: policy.maxLatePerMonth,
      maxEarlyOutPerMonth: policy.maxEarlyOutPerMonth,
      maxHalfDaysPerMonth: policy.maxHalfDaysPerMonth,
    };
  }

  /**
   * If the computed status is HALF_DAY, check whether the employee has
   * already hit the monthly cap; if so, return 'LEAVE' instead.
   */
  private async resolveHalfDay(
    employeeId: string,
    maxHalfDaysPerMonth: number,
    excludeId?: string,
  ): Promise<'HALF_DAY' | 'LEAVE'> {
    const count = await this.countHalfDaysThisMonth(employeeId, excludeId);
    return count >= maxHalfDaysPerMonth ? 'LEAVE' : 'HALF_DAY';
  }

  /**
   * If the punch-in falls in the LATE window, check whether the employee
   * has already used up their monthly late-arrival allowance; if so,
   * escalate to 'HALF_DAY' instead (which may itself escalate to 'LEAVE'
   * via resolveHalfDay once its own monthly cap is hit).
   */
  private async resolveLate(employeeId: string, maxLatePerMonth: number): Promise<'LATE' | 'HALF_DAY'> {
    const count = await this.countLateThisMonth(employeeId);
    return count >= maxLatePerMonth ? 'HALF_DAY' : 'LATE';
  }

  // ── Punch-in ───────────────────────────────────────────────────────────────

  async punchIn(employeeId: string, dto: PunchInDto, ip?: string, userAgent?: string) {
    await this.assertAttendanceAllowed(employeeId);
    const today = this.getISTToday();

    const holiday = await this.prisma.holiday.findFirst({ where: { date: today } });
    if (holiday) {
      throw new BadRequestException(`Today is marked as holiday: ${holiday.title}`);
    }

    const weekOff = await this.isWeekOff(employeeId, today);
    if (weekOff) {
      const day = today.getDay();
      throw new BadRequestException(day === 0 ? 'Sunday is a holiday — no punch-in required.' : 'Saturday is a weekly off for your department.');
    }

    const approvedLeave = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: 'APPROVED',
        fromDate: { lte: today },
        toDate: { gte: today },
      },
    });
    if (approvedLeave) {
      throw new BadRequestException('You are on approved leave today. Contact admin if this is incorrect.');
    }

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (existing?.punchInTime) {
      throw new ConflictException('Already punched in today');
    }
    if (existing?.punchOutTime) {
      throw new ConflictException('Attendance already has a punch-out for today. Please contact admin to correct this record.');
    }

    if (!dto.latitude && !dto.longitude) {
      throw new BadRequestException(
        'Location is required for punch-in. Please enable GPS and try again.',
      );
    }

    const isGeoValid = await this.geoFence.isWithinAnyOffice(dto.latitude, dto.longitude);
    const now        = new Date();
    const punchMins  = this.minutesSinceMidnight(now);
    const { LATE_CUTOFF } = await this.getEmployeeTimeConstraints(employeeId);
    const policy = await this.getPolicyLimits();

    // ── Determine punch-in status ────────────────────────────────────────────
    let punchInStatus: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'WFH' | 'LEAVE';

    if (!isGeoValid) {
      // Outside geo-fence: WFH, no time penalty
      punchInStatus = 'WFH';
    } else if (punchMins <= LATE_CUTOFF) {
      // Punched in within the allowed grace window.
      punchInStatus = 'PRESENT';
    } else if (punchMins <= HALF_DAY_PUNCH_IN_CUTOFF) {
      // After the grace window but no later than noon — subject to the
      // monthly late-arrival allowance.
      punchInStatus = await this.resolveLate(employeeId, policy.maxLatePerMonth);
    } else {
      // Punched in after noon.
      punchInStatus = 'HALF_DAY';
    }

    // If HALF_DAY, check monthly cap
    if (punchInStatus === 'HALF_DAY') {
      punchInStatus = await this.resolveHalfDay(employeeId, policy.maxHalfDaysPerMonth);
    }

    // ── Persist record ───────────────────────────────────────────────────────
    const attendanceData = {
      punchInTime: now,
      punchInLat:  dto.latitude,
      punchInLng:  dto.longitude,
      isGeoValidIn: isGeoValid,
      isManualPunch: false,
      manualPunchReason: dto.manualPunchReason ?? null,
      status: punchInStatus,
    };

    const record = existing
      ? await this.prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: attendanceData,
      })
      : await this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        date: today,
        ...attendanceData,
        deviceInfo: (dto.deviceInfo ?? {}) as any,
      },
    });

    // ── Notifications ────────────────────────────────────────────────────────
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Basic punch-in confirmation
    // ── Audit Log ────────────────────────────────────────────────────────────
    await this.prisma.auditLog.create({
      data: {
        actorId: employeeId,
        action: 'PUNCH_IN',
        resourceType: 'attendance',
        resourceId: record.id,
        ipAddress: ip,
        userAgent: userAgent,
        newValue: {
          status: punchInStatus,
          isManual: false,
          manualPunchReason: dto.manualPunchReason ?? null,
          isGeoValidIn: isGeoValid,
          location: isGeoValid ? 'OFFICE' : 'REMOTE',
          time: timeStr,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      },
    });

    this.emitAttendanceUpdated(employeeId, {
      date: today.toISOString(),
      status: record.status,
      punchInTime: record.punchInTime,
      punchOutTime: record.punchOutTime,
    });

    return record;
  }

  // ── Punch-out ──────────────────────────────────────────────────────────────

  async punchOut(employeeId: string, dto: PunchInDto, ip?: string, userAgent?: string) {
    await this.assertAttendanceAllowed(employeeId);
    const today = this.getISTToday();

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (!record?.punchInTime) {
      throw new BadRequestException('No punch-in record found for today');
    }
    if (record.punchOutTime) {
      throw new ConflictException('Already punched out today');
    }

    if (!dto.latitude && !dto.longitude) {
      throw new BadRequestException(
        'Location is required for punch-out. Please enable GPS and try again.',
      );
    }

    const isGeoValid    = await this.geoFence.isWithinAnyOffice(dto.latitude, dto.longitude);
    const now           = new Date();
    const punchOutMins  = this.minutesSinceMidnight(now);
    const workingHours  = (now.getTime() - record.punchInTime.getTime()) / (1000 * 60 * 60);
    const timeStr       = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const { EARLY_OUT_CUTOFF } = await this.getEmployeeTimeConstraints(employeeId);
    const policy = await this.getPolicyLimits();

    // ── Determine final status ───────────────────────────────────────────────
    let finalStatus: string = record.status;     // inherit punch-in status

    if (record.status === 'WFH' || record.status === 'OD') {
      finalStatus = record.status;
    } else if (workingHours < HALF_DAY_HOURS) {
      finalStatus = 'HALF_DAY';
    } else if (punchOutMins < EARLY_OUT_CUTOFF) {
      // Early punch-out — subject to the monthly early-out allowance.
      // Within the allowance, keep the inherited status; once it's used
      // up, further early punch-outs escalate to HALF_DAY.
      const earlyCount = await this.countEarlyPunchOutsThisMonth(employeeId);
      if (earlyCount >= policy.maxEarlyOutPerMonth) {
        finalStatus = 'HALF_DAY';
      }
    }
    // else: punched out at or after the allowed early punch-out limit.

    // If HALF_DAY, check monthly cap
    if (finalStatus === 'HALF_DAY') {
      finalStatus = await this.resolveHalfDay(employeeId, policy.maxHalfDaysPerMonth, record.id);
    }

    // ── Persist ──────────────────────────────────────────────────────────────
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        punchOutTime:   now,
        punchOutLat:    dto.latitude,
        punchOutLng:    dto.longitude,
        isGeoValidOut:  isGeoValid,
        workingHours:   Math.round(workingHours * 100) / 100,
        status:         finalStatus as any,
        // Mark as manual if punch-out is manual (preserve existing true if already set)
        ...(dto.manualPunchReason ? { isManualPunch: true, manualPunchReason: dto.manualPunchReason } : {}),
      },
    });

    // ── Audit Log ────────────────────────────────────────────────────────────
    await this.prisma.auditLog.create({
      data: {
        actorId: employeeId,
        action: 'PUNCH_OUT',
        resourceType: 'attendance',
        resourceId: updated.id,
        ipAddress: ip,
        userAgent: userAgent,
        newValue: {
          status: finalStatus,
          isManual: false,
          manualPunchReason: dto.manualPunchReason ?? null,
          isGeoValidOut: isGeoValid,
          location: isGeoValid ? 'OFFICE' : 'REMOTE',
          workingHours: Math.round(workingHours * 100) / 100,
          time: timeStr,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      },
    });

    this.emitAttendanceUpdated(employeeId, {
      date: today.toISOString(),
      status: updated.status,
      punchInTime: updated.punchInTime,
      punchOutTime: updated.punchOutTime,
    });

    return updated;
  }

  // ── Other methods (unchanged) ─────────────────────────────────────────────

  async getOpenOd(employeeId: string) {
    await this.assertAttendanceAllowed(employeeId);
    return this.prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        OR: [{ status: 'OD' }, { notes: 'OD' }],
        punchInTime: { not: null },
        punchOutTime: null,
      },
      orderBy: { punchInTime: 'desc' },
    });
  }

  async odPunchIn(employeeId: string, dto: OdPunchInDto, ip?: string, userAgent?: string) {
    await this.assertAttendanceAllowed(employeeId);

    const openOd = await this.getOpenOd(employeeId);
    if (openOd) {
      throw new ConflictException('You already have an open OD entry. Please add the punch-out time first.');
    }

    const punchInTime = new Date(dto.punchInTime);
    if (Number.isNaN(punchInTime.getTime())) {
      throw new BadRequestException('Invalid OD punch-in time.');
    }

    const date = this.getISTDateFor(punchInTime);
    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });
    if (existing?.punchInTime || existing?.punchOutTime) {
      throw new ConflictException('Attendance already exists for this date.');
    }

    const reason = dto.reason?.trim() || 'OD';
    const record = await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: {
        employeeId,
        date,
        punchInTime,
        status: 'OD',
        isManualPunch: true,
        manualPunchReason: reason,
        deviceInfo: {},
      },
      update: {
        punchInTime,
        status: 'OD',
        isManualPunch: true,
        manualPunchReason: reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: employeeId,
        action: 'OD_PUNCH_IN',
        resourceType: 'attendance',
        resourceId: record.id,
        ipAddress: ip,
        userAgent,
        newValue: record as object,
      },
    });

    this.emitAttendanceUpdated(employeeId, {
      date: record.date.toISOString(),
      status: record.status,
      punchInTime: record.punchInTime,
      punchOutTime: record.punchOutTime,
    });

    return record;
  }

  async odPunchOut(employeeId: string, dto: OdPunchOutDto, ip?: string, userAgent?: string) {
    await this.assertAttendanceAllowed(employeeId);

    const record = await this.getOpenOd(employeeId);
    if (!record?.punchInTime) {
      throw new BadRequestException('No open OD entry found.');
    }

    const punchOutTime = new Date(dto.punchOutTime);
    if (Number.isNaN(punchOutTime.getTime())) {
      throw new BadRequestException('Invalid OD punch-out time.');
    }
    if (punchOutTime <= record.punchInTime) {
      throw new BadRequestException('OD punch-out time must be after punch-in time.');
    }

    const reason = dto.reason?.trim() || record.manualPunchReason || 'OD';
    const workingHours = this.calculateWorkingHours(record.punchInTime, punchOutTime);
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        punchOutTime,
        workingHours,
        status: 'OD',
        isManualPunch: true,
        manualPunchReason: reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: employeeId,
        action: 'OD_PUNCH_OUT',
        resourceType: 'attendance',
        resourceId: updated.id,
        ipAddress: ip,
        userAgent,
        oldValue: record as object,
        newValue: updated as object,
      },
    });

    this.emitAttendanceUpdated(employeeId, {
      date: updated.date.toISOString(),
      status: updated.status,
      punchInTime: updated.punchInTime,
      punchOutTime: updated.punchOutTime,
    });

    return updated;
  }

  async getToday(employeeId: string) {
    await this.assertAttendanceAllowed(employeeId);
    const today = this.getISTToday();
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    return record;
  }

  async getByEmployee(
    employeeId: string,
    from?: string,
    to?: string,
    limit?: number,
  ) {
    await this.assertAttendanceAllowed(employeeId);
    const where: Record<string, unknown> = { employeeId };
    if (from || to) {
      where['date'] = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }
    const records = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: { date: 'desc' },
      ...(limit ? { take: limit } : {}),
    });
    return records;
  }

  async getEmployeeOverview(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true, status: true },
    });
    if (!employee) throw new BadRequestException('Employee not found');

    const today = this.getISTToday();
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const records = await this.prisma.attendanceRecord.findMany({
      where: { employeeId, date: { gte: monthStart, lte: today } },
      orderBy: { date: 'desc' },
    });

    const count = (status: string) => records.filter(record => record.status === status).length;
    const present = count('PRESENT');
    const late = count('LATE');
    const halfDay = count('HALF_DAY');
    const leave = count('LEAVE');
    const absent = count('ABSENT');
    const wfh = count('WFH');
    const od = count('OD');
    const attended = present + late + halfDay + wfh + od;
    const lateFrequency = attended > 0 ? Math.round((late / attended) * 100) : 0;
    const punctuality = attended > 0 ? Math.round(((present + wfh + od) / attended) * 100) : 0;
    const totalHours = records.reduce((sum, record) => sum + Number(record.workingHours ?? 0), 0);
    const todayRecord = records.find(record => record.date.getTime() === today.getTime()) ?? null;

    return {
      employee,
      period: {
        from: monthStart,
        to: today,
        month: today.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' }),
      },
      summary: {
        totalRecords: records.length,
        present,
        late,
        halfDay,
        leave,
        absent,
        wfh,
        od,
        attended,
        lateFrequency,
        punctuality,
        totalHours: Math.round(totalHours * 100) / 100,
      },
      today: todayRecord,
      records,
    };
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

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, email: true, employeeCode: true } },
      },
      orderBy: [{ date: 'desc' }, { punchInTime: 'asc' }],
    });

    const activeRecords = records.filter((record) => !isAttendanceBlockedIdentity(record.employee));
    return activeRecords;
  }

  async regularize(id: string, adminId: string, dto: RegularizeDto) {
    const record = await this.assertAttendanceRecordAllowed(id);

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

    this.emitAttendanceUpdated(record.employeeId, {
      date: updated.date.toISOString(),
      status: updated.status,
      punchInTime: updated.punchInTime,
      punchOutTime: updated.punchOutTime,
    });

    return updated;
  }

  async getMyStats(employeeId: string) {
    await this.assertAttendanceAllowed(employeeId);
    const today = this.getISTToday();
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

    let daysPresent = 0, daysHalfDay = 0, daysOnLeave = 0, daysAbsent = 0, daysLate = 0;
    for (const r of records) {
      if      (r.status === 'PRESENT' || r.status === 'WFH' || r.status === 'OD') daysPresent++;
      else if (r.status === 'LATE')     daysLate++;
      else if (r.status === 'HALF_DAY') daysHalfDay++;
      else if (r.status === 'LEAVE')    daysOnLeave++;
      else if (r.status === 'ABSENT')   daysAbsent++;
    }

    const attendedDays      = daysPresent + daysLate + daysHalfDay * 0.5 + daysOnLeave;
    const attendancePercent = totalWorkingDays > 0
      ? Math.round((attendedDays / totalWorkingDays) * 100)
      : 0;

    const monthName = today.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' }).toUpperCase();
    return {
      month: monthName,
      totalWorkingDays,
      daysPresent,
      daysLate,
      daysHalfDay,
      daysOnLeave,
      daysAbsent,
      attendedDays,
      attendancePercent,
    };
  }

  /** Returns a summary of the employee's monthly policy usage. */
  async getPolicyUsage(employeeId: string) {
    await this.assertAttendanceAllowed(employeeId);
    const [lateCount, earlyCount, halfDayCount, constraints, limits] = await Promise.all([
      this.countLateThisMonth(employeeId),
      this.countEarlyPunchOutsThisMonth(employeeId),
      this.countHalfDaysThisMonth(employeeId),
      this.getEmployeeTimeConstraints(employeeId),
      this.getPolicyLimits(),
    ]);
    return {
      latePunchIns:          { used: lateCount,    allowed: limits.maxLatePerMonth,     remaining: Math.max(0, limits.maxLatePerMonth - lateCount) },
      earlyPunchOuts:        { used: earlyCount,   allowed: limits.maxEarlyOutPerMonth, remaining: Math.max(0, limits.maxEarlyOutPerMonth - earlyCount) },
      halfDays:              { used: halfDayCount, allowed: limits.maxHalfDaysPerMonth, remaining: Math.max(0, limits.maxHalfDaysPerMonth - halfDayCount) },
      policy: constraints.policyText,
    };
  }

  /** Returns the current company-wide attendance policy (admin view). */
  async getAttendancePolicy() {
    return this.prisma.attendancePolicy.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  /** Updates the company-wide attendance policy. */
  async updateAttendancePolicy(adminId: string, dto: UpdateAttendancePolicyDto) {
    const updated = await this.prisma.attendancePolicy.upsert({
      where: { id: 'default' },
      update: {
        ...(dto.maxLatePerMonth     !== undefined ? { maxLatePerMonth: dto.maxLatePerMonth } : {}),
        ...(dto.maxEarlyOutPerMonth !== undefined ? { maxEarlyOutPerMonth: dto.maxEarlyOutPerMonth } : {}),
        ...(dto.maxHalfDaysPerMonth !== undefined ? { maxHalfDaysPerMonth: dto.maxHalfDaysPerMonth } : {}),
        updatedBy: adminId,
      },
      create: {
        id: 'default',
        maxLatePerMonth: dto.maxLatePerMonth ?? 2,
        maxEarlyOutPerMonth: dto.maxEarlyOutPerMonth ?? 2,
        maxHalfDaysPerMonth: dto.maxHalfDaysPerMonth ?? 4,
        updatedBy: adminId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'UPDATE_ATTENDANCE_POLICY',
        resourceType: 'attendance_policy',
        resourceId: updated.id,
        newValue: updated as object,
      },
    });

    return updated;
  }



  private minutesSinceMidnight(date: Date): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: ATTENDANCE_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
  }

  async editAttendanceTime(
    id: string,
    adminId: string,
    dto: EditTimeDto,
  ) {
    const record = await this.assertAttendanceRecordAllowed(id);

    const edits: Array<{ field: string; original: string | null; newVal: string | null }> = [];
    const updateData: Record<string, any> = {
      isRegularized: true,
      regularizedBy: adminId,
      regularizationReason: dto.reason,
    };

    if (dto.punchInTime) {
      edits.push({ field: 'punchInTime', original: record.punchInTime?.toISOString() ?? null, newVal: new Date(dto.punchInTime).toISOString() });
      updateData['punchInTime'] = new Date(dto.punchInTime);
    }
    if (dto.punchOutTime) {
      edits.push({ field: 'punchOutTime', original: record.punchOutTime?.toISOString() ?? null, newVal: new Date(dto.punchOutTime).toISOString() });
      updateData['punchOutTime'] = new Date(dto.punchOutTime);
    }

    const newIn  = dto.punchInTime  ? new Date(dto.punchInTime)  : record.punchInTime;
    const newOut = dto.punchOutTime ? new Date(dto.punchOutTime) : record.punchOutTime;
    if (newIn && newOut) {
      updateData['workingHours'] =
        Math.round(((newOut.getTime() - newIn.getTime()) / (1000 * 60 * 60)) * 100) / 100;
    }

    const updated = await this.prisma.attendanceRecord.update({ where: { id }, data: updateData });

    await Promise.all(
      edits.map(e =>
        this.prisma.attendanceEditHistory.create({
          data: { attendanceId: id, editedBy: adminId, fieldChanged: e.field, originalValue: e.original, newValue: e.newVal, reason: dto.reason },
        }),
      ),
    );

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'EDIT_ATTENDANCE_TIME',
        resourceType: 'attendance',
        resourceId: id,
        oldValue: { punchInTime: record.punchInTime, punchOutTime: record.punchOutTime } as object,
        newValue: { punchInTime: newIn, punchOutTime: newOut } as object,
      },
    });

    this.emitAttendanceUpdated(record.employeeId, {
      date: updated.date.toISOString(),
      status: updated.status,
      punchInTime: updated.punchInTime,
      punchOutTime: updated.punchOutTime,
    });

    return updated;
  }

  async getEditHistory(attendanceId: string) {
    await this.assertAttendanceRecordAllowed(attendanceId);

    return this.prisma.attendanceEditHistory.findMany({
      where: { attendanceId },
      include: { editor: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminUpsert(adminId: string, dto: AdminUpsertAttendanceDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, firstName: true, lastName: true }
    });
    if (!employee) {
      throw new BadRequestException('Employee not found');
    }

    const date = new Date(dto.date);
    date.setUTCHours(0, 0, 0, 0);

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: dto.employeeId,
          date,
        },
      },
    });

    const punchInTime = dto.punchInTime
      ? new Date(dto.punchInTime)
      : existing?.punchInTime ?? null;
    const punchOutTime = dto.punchOutTime
      ? new Date(dto.punchOutTime)
      : existing?.punchOutTime ?? null;

    let workingHours = null;
    if (punchInTime && punchOutTime) {
      workingHours = Math.round(
        ((punchOutTime.getTime() - punchInTime.getTime()) / (1000 * 60 * 60)) * 100
      ) / 100;
    } else if (existing?.workingHours) {
      workingHours = existing.workingHours as any;
    }

    const record = await this.prisma.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: dto.employeeId,
          date,
        }
      },
      create: {
        employeeId: dto.employeeId,
        date,
        punchInTime,
        punchOutTime,
        punchInLat: punchInTime ? 22.3097 : null,
        punchInLng: punchInTime ? 73.1376 : null,
        punchOutLat: punchOutTime ? 22.3097 : null,
        punchOutLng: punchOutTime ? 73.1376 : null,
        isGeoValidIn: punchInTime ? true : null,
        isGeoValidOut: punchOutTime ? true : null,
        status: dto.status,
        workingHours,
        isRegularized: true,
        regularizedBy: adminId,
        regularizationReason: dto.reason,
        isManualPunch: true,
        manualPunchReason: 'Admin manual punch adjustment',
        notes: dto.reason,
      },
      update: {
        punchInTime,
        punchOutTime,
        punchInLat: dto.punchInTime ? 22.3097 : existing?.punchInLat,
        punchInLng: dto.punchInTime ? 73.1376 : existing?.punchInLng,
        punchOutLat: dto.punchOutTime ? 22.3097 : existing?.punchOutLat,
        punchOutLng: dto.punchOutTime ? 73.1376 : existing?.punchOutLng,
        isGeoValidIn: dto.punchInTime ? true : existing?.isGeoValidIn,
        isGeoValidOut: dto.punchOutTime ? true : existing?.isGeoValidOut,
        status: dto.status,
        workingHours,
        isRegularized: true,
        regularizedBy: adminId,
        regularizationReason: dto.reason,
        isManualPunch: true,
        manualPunchReason: 'Admin manual punch adjustment',
        notes: dto.reason,
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ADMIN_UPSERT_ATTENDANCE',
        resourceType: 'attendance',
        resourceId: record.id,
        newValue: {
          employeeId: dto.employeeId,
          date: dto.date,
          punchInTime,
          punchOutTime,
          status: dto.status,
          workingHours,
          reason: dto.reason,
        }
      }
    });

    this.emitAttendanceUpdated(dto.employeeId, {
      date: record.date.toISOString(),
      status: record.status,
      punchInTime: record.punchInTime,
      punchOutTime: record.punchOutTime,
    });

    return record;
  }
}

