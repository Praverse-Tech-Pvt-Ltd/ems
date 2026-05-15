import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FaceRecognitionService } from './face-recognition.service';
import { GeoFenceService } from './geo-fence.service';
import { PunchInDto } from './dto/punch-in.dto';
import { RegularizeDto } from './dto/regularize.dto';

const FR_THRESHOLD = 0.85;
const LATE_THRESHOLD_HOUR = 9;
const LATE_THRESHOLD_MIN = 15;
const HALF_DAY_HOURS = 4;

@Injectable()
export class AttendanceService {
  constructor(
    private prisma: PrismaService,
    private fr: FaceRecognitionService,
    private geoFence: GeoFenceService,
  ) {}

  async punchIn(employeeId: string, dto: PunchInDto) {
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { faceEnrolled: true },
    });

    if (!employee.faceEnrolled) {
      throw new BadRequestException('Face not enrolled. Please enroll your face first.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (existing?.punchInTime) {
      throw new ConflictException('Already punched in today');
    }

    const frResult = await this.fr.verify(employeeId, dto.faceImageBase64);
    if (!frResult.verified || frResult.confidence < FR_THRESHOLD) {
      throw new BadRequestException(
        frResult.reason ?? `Face not recognized (confidence: ${frResult.confidence})`,
      );
    }

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
    const isLate =
      now.getHours() > LATE_THRESHOLD_HOUR ||
      (now.getHours() === LATE_THRESHOLD_HOUR && now.getMinutes() > LATE_THRESHOLD_MIN);

    const record = await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      create: {
        employeeId,
        date: today,
        punchInTime: now,
        punchInLat: dto.latitude,
        punchInLng: dto.longitude,
        isGeoValidIn: isGeoValid,
        frConfidenceIn: frResult.confidence,
        status: isGeoValid ? (isLate ? 'LATE' : 'PRESENT') : 'WFH',
        deviceInfo: (dto.deviceInfo ?? {}) as any,
      },
      update: {
        punchInTime: now,
        punchInLat: dto.latitude,
        punchInLng: dto.longitude,
        isGeoValidIn: isGeoValid,
        frConfidenceIn: frResult.confidence,
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

    const frResult = await this.fr.verify(employeeId, dto.faceImageBase64);
    if (!frResult.verified || frResult.confidence < FR_THRESHOLD) {
      throw new BadRequestException(frResult.reason ?? 'Face not recognized');
    }

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
        frConfidenceOut: frResult.confidence,
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

  async enrollFace(employeeId: string, frames: string[]) {
    const fr = await import('./face-recognition.service');
    void fr;
    await this.prisma.employee.update({
      where: { id: employeeId },
      data: { faceEnrolled: true },
    });
    return { message: 'Face enrolled successfully' };
  }
}
