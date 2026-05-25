import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceFaceService } from './attendance-face.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * NOTE: The face microservice performs only 1:1 verification (employee ID +
 * face image). It does NOT support 1:N recognition (face image alone).
 *
 * Employee check-in is handled by the attendance module's punch-in endpoint
 * (/attendance/punch-in), where the employee's identity comes from their JWT
 * and the face image is verified 1:1 against their stored embedding.
 *
 * This controller exposes admin/reporting endpoints only.
 */

class CheckOutDto {
  @ApiProperty({ description: 'Employee UUID' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ description: 'Base64-encoded face image' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;
}

@ApiTags('Face Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance/face')
export class AttendanceFaceController {
  constructor(private readonly service: AttendanceFaceService) {}

  /**
   * Manual check-out via face verification (admin / kiosk use).
   * Standard employee check-out uses the attendance punch-out endpoint.
   */
  @Post('check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark attendance check-out via face verification (1:1)' })
  async checkOut(@Body() dto: CheckOutDto) {
    return this.service.checkOutByFace(dto.employeeId, dto.imageBase64);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's attendance records" })
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  async today() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.service.getAttendanceByDate(today);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get attendance records for an employee' })
  @ApiQuery({ name: 'from', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2025-12-31' })
  async employeeAttendance(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();
    return this.service.getEmployeeAttendance(employeeId, fromDate, toDate);
  }
}
