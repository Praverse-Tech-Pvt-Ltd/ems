import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FaceRecognitionService } from './face-recognition.service';
import { GeoFenceService } from './geo-fence.service';
import { PunchInDto } from './dto/punch-in.dto';
import { RegularizeDto } from './dto/regularize.dto';

const FR_THRESHOLD = 0.85;
const LATE_THRESHOLD_HOUR = 9;
const LATE_THRESHOLD_MIN = 30;
const HALF_DAY_HOURS = 4;

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private fr: FaceRecognitionService,
    private geoFence: GeoFenceService,
  ) {}

  /** Verifies face for enrolled employees. Throws if FR service is down or face doesn't match. */
  private async verifyFaceOrThrow(employeeId: string, faceImageBase64: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { faceEnrolled: true },
    });

    if (!employee?.faceEnrolled) return; // not enrolled yet — skip

    try {
      const result = await this.fr.verify(employeeId, faceImageBase64);
      if (!result.verified) {
        throw new BadRequestException(
          result.reason ?? `Face not recognized (confidence: ${(result.confidence * 100).toFixed(0)}%). Please try again in better lighting.`,
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // FR service is down
      this.logger.warn(`FR service unavailable for ${employeeId}: ${(err as Error).message}`);
      throw new BadRequestException(
        'Face recognition service is offline. Please contact admin to punch in manually.',
      );
    }
  }

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

    if (!isGeoValid) {
      const approvedWfh = await this.prisma.employeeRequest.findFirst({
        where: {
          employeeId,
          requestType: 'WFH',
          status: 'APPROVED',
          details: { path: ['date'], equals: today.toISOString().split('T')[0] },
        },
      });
      if (!approvedWfh) {
        throw new ForbiddenException(
          'You are outside the office geo-fence. Submit a WFH request if working remotely.',
        );
      }
    }

    const now = new Date();
    const policy = await this.attendancePolicy();
    const isLate = this.minutesSinceMidnight(now) > policy.startMinutes + policy.graceMinutes;

    const record = await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      create: {
        employeeId,
        date: today,
        punchInTime: now,
        punchInLat: dto.latitude,
        punchInLng: dto.longitude,
        isGeoValidIn: isGeoValid,
        frConfidenceIn: null,
        status: isGeoValid ? (isLate ? 'LATE' : 'PRESENT') : 'WFH',
        deviceInfo: (dto.deviceInfo ?? {}) as any,
      },
      update: {
        punchInTime: now,
        punchInLat: dto.latitude,
        punchInLng: dto.longitude,
        isGeoValidIn: isGeoValid,
        frConfidenceIn: null,
        status: isGeoValid ? (isLate ? 'LATE' : 'PRESENT') : 'WFH',
      },
    });

    await this.prisma.notification.create({
      data: {
        employeeId,
        type: 'PUNCH_IN',
        title: 'Punched In',
        body: `You punched in at ${now.toLocaleTimeString('en-IN')}`,
        referenceId: record.id,
        referenceType: 'attendance',
      },
    });

    return record;
  }

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

    const now = new Date();
    const isGeoValid = await this.geoFence.isWithinAnyOffice(dto.latitude, dto.longitude);
    const workingHours =
      (now.getTime() - record.punchInTime.getTime()) / (1000 * 60 * 60);

    const status =
      workingHours < HALF_DAY_HOURS
        ? 'HALF_DAY'
        : record.status === 'WFH'
          ? 'WFH'
          : record.status;

    const updated = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        punchOutTime: now,
        punchOutLat: dto.latitude,
        punchOutLng: dto.longitude,
        isGeoValidOut: isGeoValid,
        frConfidenceOut: null,
        workingHours: Math.round(workingHours * 100) / 100,
        status,
      },
    });

    return updated;
  }

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
        ...(to ? { lte: new Date(to) } : {}),
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
        ...(to ? { lte: new Date(to) } : {}),
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
        punchInTime: dto.punchInTime ? new Date(dto.punchInTime) : record.punchInTime,
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
        actorId: adminId,
        action: 'REGULARIZE',
        resourceType: 'attendance',
        resourceId: id,
        oldValue: record as object,
        newValue: updated as object,
      },
    });

    return updated;
  }

  async resetFace(employeeId: string) {
    try {
      await this.fr.deleteFace(employeeId);
    } catch {
      // FR service may be unavailable — continue to mark as unenrolled anyway
    }
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { faceEnrolled: false },
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
      const isServiceDown = msg.toLowerCase().includes('unavailable');
      if (!isServiceDown) {
        // Face detection failed in all frames — tell the user to retry
        throw new BadRequestException(
          msg || 'No face detected in the captured frames. Please retry in better lighting.',
        );
      }
      // FR service is down — mark enrolled anyway so the user isn't permanently blocked;
      // punch-in will soft-pass until the service comes back.
      this.logger.warn(
        `FR service down during enrollment for ${employeeId}. Marking enrolled without embedding.`,
      );
    }

    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { faceEnrolled: true },
    });

    return { message: 'Face enrolled successfully.' };
  }

  private async attendancePolicy() {
    const setting = await this.prisma.companySetting.findUnique({ where: { key: 'working_hours' } });
    const value = setting?.value as { start?: string; graceMinutes?: number } | undefined;
    const [hour, minute] = (value?.start ?? `${String(LATE_THRESHOLD_HOUR).padStart(2, '0')}:${String(LATE_THRESHOLD_MIN).padStart(2, '0')}`).split(':').map(Number);
    return {
      startMinutes: (hour ?? LATE_THRESHOLD_HOUR) * 60 + (minute ?? LATE_THRESHOLD_MIN),
      graceMinutes: Number(value?.graceMinutes ?? 0),
    };
  }

  private minutesSinceMidnight(date: Date) {
    return date.getHours() * 60 + date.getMinutes();
  }
}
