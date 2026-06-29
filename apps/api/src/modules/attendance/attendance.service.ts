import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

import { GeoFenceService } from './geo-fence.service';
import { PunchInDto } from './dto/punch-in.dto';
import { RegularizeDto } from './dto/regularize.dto';

// ── Attendance Policy Constants ────────────────────────────────────────────────
const HALF_DAY_HOURS = 4;           // < 4 h worked → auto HALF_DAY at punch-out

// Allowance constants per month
const MAX_LATE_PM      = 4;             // late punch-in allowances per month
const MAX_EARLY_PM     = 4;             // early punch-out allowances per month
const MAX_HALFDAY_PM   = 4;             // > 4 half-days in a month → LEAVE

// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private geoFence: GeoFenceService,
  ) {}



  private getISTToday(): Date {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + (3600000 * 5.5));
    return new Date(Date.UTC(ist.getFullYear(), ist.getMonth(), ist.getDate()));
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

  private async getEmployeeTimeConstraints(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { firstName: true }
    });
    const name = employee?.firstName.toLowerCase() || '';

    // Shift 09:00-17:30 -> grace window 09:30 / late until 12:00 / early-out 17:15
    if (name.includes('shifa') || name.includes('chandni') || name.includes('dilip')) {
      return {
        PRESENT_CUTOFF:   9 * 60 + 30,  // 09:30 AM
        LATE_CUTOFF:      12 * 60,      // 12:00 PM
        EARLY_OUT_CUTOFF: 17 * 60 + 15, // 05:15 PM
        policyText: {
          presentCutoff:  '09:30',
          lateCutoff:     '12:00',
          earlyOutCutoff: '17:15',
          regularPunchOut:'17:30',
        },
      };
    }

    // Shift 10:00-18:30 -> grace window 10:30 / late until 12:00 / early-out 18:15
    if (name.includes('maanav')) {
      return {
        PRESENT_CUTOFF:   10 * 60 + 30, // 10:30 AM
        LATE_CUTOFF:      12 * 60,      // 12:00 PM
        EARLY_OUT_CUTOFF: 18 * 60 + 15, // 06:15 PM
        policyText: {
          presentCutoff:  '10:30',
          lateCutoff:     '12:00',
          earlyOutCutoff: '18:15',
          regularPunchOut:'18:30',
        },
      };
    }

    // Default shift 09:30-18:00 -> grace window 10:00 / late until 12:00 / early-out 17:45
    return {
      PRESENT_CUTOFF:   10 * 60,      // 10:00 AM
      LATE_CUTOFF:      12 * 60,      // 12:00 PM
      EARLY_OUT_CUTOFF: 17 * 60 + 45, // 05:45 PM
      policyText: {
        presentCutoff:  '10:00',
        lateCutoff:     '12:00',
        earlyOutCutoff: '17:45',
        regularPunchOut:'18:00',
      },
    };
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

  async punchIn(employeeId: string, dto: PunchInDto, ip?: string, userAgent?: string) {
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

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });
    if (existing?.punchInTime) {
      throw new ConflictException('Already punched in today');
    }

    if (!dto.latitude && !dto.longitude) {
      throw new BadRequestException(
        'Location is required for punch-in. Please enable GPS and try again.',
      );
    }

    const isGeoValid = await this.geoFence.isWithinAnyOffice(dto.latitude, dto.longitude);
    const now        = new Date();
    const punchMins  = this.minutesSinceMidnight(now);
    const { PRESENT_CUTOFF, LATE_CUTOFF } = await this.getEmployeeTimeConstraints(employeeId);

    // ── Determine punch-in status ────────────────────────────────────────────
    let punchInStatus: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'WFH' | 'LEAVE';

    if (!isGeoValid) {
      // Outside geo-fence: WFH, no time penalty
      punchInStatus = 'WFH';
    } else if (punchMins <= PRESENT_CUTOFF) {
      // Within allowance
      punchInStatus = 'PRESENT';
    } else if (punchMins <= LATE_CUTOFF) {
      // Late punch-in window: check monthly late allowance
      const lateCount = await this.countLateThisMonth(employeeId);
      punchInStatus   = lateCount < MAX_LATE_PM ? 'LATE' : 'HALF_DAY';
    } else {
      // After late window: straight HALF_DAY
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
        isManualPunch: false,
        manualPunchReason: dto.manualPunchReason ?? null,
        status: punchInStatus,
        deviceInfo: (dto.deviceInfo ?? {}) as any,
      },
      update: {
        punchInTime: now,
        punchInLat:  dto.latitude,
        punchInLng:  dto.longitude,
        isGeoValidIn: isGeoValid,
        frConfidenceIn: null,
        isManualPunch: false,
        manualPunchReason: dto.manualPunchReason ?? null,
        status: punchInStatus,
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

    return record;
  }

  // ── Punch-out ──────────────────────────────────────────────────────────────

  async punchOut(employeeId: string, dto: PunchInDto, ip?: string, userAgent?: string) {
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

    return updated;
  }

  // ── Other methods (unchanged) ─────────────────────────────────────────────

  async getToday(employeeId: string) {
    const today = this.getISTToday();
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
    const attended = present + late + halfDay + wfh;
    const lateFrequency = attended > 0 ? Math.round((late / attended) * 100) : 0;
    const punctuality = attended > 0 ? Math.round(((present + wfh) / attended) * 100) : 0;
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

    const monthName = today.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' }).toUpperCase();
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
    const [lateCount, earlyCount, halfDayCount, constraints] = await Promise.all([
      this.countLateThisMonth(employeeId),
      this.countEarlyPunchOutsThisMonth(employeeId),
      this.countHalfDaysThisMonth(employeeId),
      this.getEmployeeTimeConstraints(employeeId),
    ]);
    return {
      latePunchIns:          { used: lateCount,    allowed: MAX_LATE_PM,     remaining: Math.max(0, MAX_LATE_PM - lateCount) },
      earlyPunchOuts:        { used: earlyCount,   allowed: MAX_EARLY_PM,    remaining: Math.max(0, MAX_EARLY_PM - earlyCount) },
      halfDays:              { used: halfDayCount, allowed: MAX_HALFDAY_PM,  remaining: Math.max(0, MAX_HALFDAY_PM - halfDayCount) },
      policy: constraints.policyText,
    };
  }



  private minutesSinceMidnight(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
  }

  async editAttendanceTime(
    id: string,
    adminId: string,
    dto: { punchInTime?: string; punchOutTime?: string; reason: string },
  ) {
    const record = await this.prisma.attendanceRecord.findUniqueOrThrow({ where: { id } });

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

    return updated;
  }

  async getEditHistory(attendanceId: string) {
    return this.prisma.attendanceEditHistory.findMany({
      where: { attendanceId },
      include: { editor: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
