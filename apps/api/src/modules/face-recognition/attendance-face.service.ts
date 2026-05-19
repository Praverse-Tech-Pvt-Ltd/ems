import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FaceRecognitionService } from './face-recognition.service';

@Injectable()
export class AttendanceFaceService {
  private readonly logger = new Logger(AttendanceFaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faceService: FaceRecognitionService,
  ) {}

  async checkInByFace(imageBase64: string) {
    const result = await this.faceService.recognize(imageBase64);

    if (!result.success || !result.employeeId) {
      throw new UnauthorizedException(result.message ?? 'Face not recognized');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: result.employeeId, date: today } },
    });

    if (existing?.punchInTime) {
      throw new ConflictException('Attendance already marked for today');
    }

    const now = new Date();
    const record = await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: result.employeeId, date: today } },
      create: {
        employeeId: result.employeeId,
        date: today,
        punchInTime: now,
        frConfidenceIn: result.confidence ?? null,
        status: 'PRESENT',
      },
      update: {
        punchInTime: now,
        frConfidenceIn: result.confidence ?? null,
        status: 'PRESENT',
      },
    });

    this.logger.log(`Check-in: employee=${result.employeeId} confidence=${result.confidence}`);

    return {
      success: true,
      employeeId: result.employeeId,
      confidence: result.confidence,
      checkIn: record.punchInTime,
      message: 'Attendance marked successfully',
    };
  }

  async checkOutByFace(employeeId: string, imageBase64: string) {
    const result = await this.faceService.verify(employeeId, imageBase64);

    if (!result.match) {
      throw new UnauthorizedException('Face verification failed');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    });

    if (!record?.punchInTime) {
      throw new NotFoundException('No check-in record found for today');
    }

    const now = new Date();
    const workingHours =
      (now.getTime() - record.punchInTime.getTime()) / (1000 * 60 * 60);

    const updated = await this.prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        punchOutTime: now,
        frConfidenceOut: result.confidence ?? null,
        workingHours: Math.round(workingHours * 100) / 100,
      },
    });

    return {
      success: true,
      checkIn: updated.punchInTime,
      checkOut: updated.punchOutTime,
      message: 'Check-out recorded',
    };
  }

  async getAttendanceByDate(date: Date) {
    return this.prisma.attendanceRecord.findMany({
      where: { date },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { punchInTime: 'asc' },
    });
  }

  async getEmployeeAttendance(employeeId: string, from: Date, to: Date) {
    return this.prisma.attendanceRecord.findMany({
      where: { employeeId, date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
    });
  }
}
