import { IsString, IsOptional, IsEnum, IsDateString, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';

export class AdminUpsertAttendanceDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty()
  @IsDateString()
  date: string; // e.g. '2026-06-23'

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  punchInTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  punchOutTime?: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}
