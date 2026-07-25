import {
  IsEmail, IsString, IsOptional, IsEnum, IsUUID, IsDateString, MaxLength, IsInt, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateEmployeeDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  firstName: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  designation?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.EMPLOYEE })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiProperty()
  @IsDateString()
  joiningDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salaryGrade?: string;

  @ApiPropertyOptional({ description: 'Shift start, minutes since midnight IST. Omit to use the company-default shift.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  shiftStartMinutes?: number;

  @ApiPropertyOptional({ description: 'Shift end, minutes since midnight IST. Omit to use the company-default shift.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  shiftEndMinutes?: number;
}
