import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AttendanceFaceService } from './attendance-face.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class CheckInDto {
  @ApiProperty({ description: 'Base64 image from webcam' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;
}

class CheckOutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty()
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

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark attendance check-in via face recognition (1:N)' })
  async checkIn(@Body() dto: CheckInDto) {
    return this.service.checkInByFace(dto.imageBase64);
  }

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
    @Param('employeeId') employeeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();
    return this.service.getEmployeeAttendance(employeeId, fromDate, toDate);
  }
}
