import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsIn,
  IsArray,
  IsUUID,
  IsDateString,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Settings ─────────────────────────────────────────────────────────────────

/**
 * Company settings values are deliberately schema-free (arbitrary JSON).
 * We only require the caller to supply a non-null object.
 */
export class UpsertSettingDto {
  @ApiProperty({ description: 'Arbitrary JSON value for this setting key' })
  @IsObject()
  value: Record<string, unknown>;
}

// ── Holidays ──────────────────────────────────────────────────────────────────

export class CreateHolidayDto {
  @ApiProperty({ example: '2025-08-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Independence Day' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}

// ── Policies ──────────────────────────────────────────────────────────────────

export class CreatePolicyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50_000)
  body: string;

  @ApiPropertyOptional({ default: '1.0' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  version?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'PUBLISHED' })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' })
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: string;

  @ApiPropertyOptional({ example: '2025-12-31T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiProperty({ type: [String], description: 'Employee UUIDs to assign the task to' })
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds: string[];
}

// ── Chat channels ─────────────────────────────────────────────────────────────

export class CreateChannelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ type: [String], description: 'Employee UUIDs to add to the channel' })
  @IsArray()
  @IsUUID('4', { each: true })
  employeeIds: string[];
}

// ── Chat messages ─────────────────────────────────────────────────────────────

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}

// ── Lifecycle events ──────────────────────────────────────────────────────────

const LIFECYCLE_EVENT_TYPES = [
  'JOINING',
  'CONFIRMATION',
  'PROMOTION',
  'TRANSFER',
  'TERMINATION',
  'OTHER',
] as const;

const LIFECYCLE_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export class CreateLifecycleDto {
  @ApiProperty({ description: 'Employee UUID' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ enum: LIFECYCLE_EVENT_TYPES })
  @IsIn(LIFECYCLE_EVENT_TYPES as unknown as string[])
  eventType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: LIFECYCLE_STATUSES, default: 'OPEN' })
  @IsOptional()
  @IsIn(LIFECYCLE_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ example: '2025-12-31T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
