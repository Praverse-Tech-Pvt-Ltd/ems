/**
 * AttendanceFaceService
 *
 * NOTE: The face microservice supports only 1:1 verification (given an
 * employee ID, does this face match?). It does NOT support 1:N recognition
 * (who is this person?).  The check-in flow therefore requires the employee
 * to be identified by their JWT before the face can be verified — see the
 * attendance controller's punch-in endpoint for the correct flow.
 *
 * This service is retained as a thin convenience wrapper used by the
 * face-recognition module's internal tests and admin tooling.
 */
import {
  Injectable,
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

  /**
   * Verify and record check-out for a known employee.
   * Check-in uses the attendance module's punch-in endpoint directly (JWT
   * identifies the employee; face verification confirms presence).
   */
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
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
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
