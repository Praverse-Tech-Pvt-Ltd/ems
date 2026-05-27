import {
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  IsOptional,
  IsObject,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';

/** Rough byte budget for the serialised deviceInfo object (4 KB). */
const DEVICE_INFO_MAX_BYTES = 4096;

export class PunchInDto {
  @ApiPropertyOptional({ description: 'Base64 encoded face image (required unless manualPunch=true)' })
  @ValidateIf(o => !o.manualPunch)
  @IsString()
  faceImageBase64?: string;

  @ApiPropertyOptional({
    description: 'Skip face verification (only allowed when face service is unavailable). Location is still required.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  manualPunch?: boolean;

  @ApiPropertyOptional({ description: 'Reason for manual punch (face service down, camera unavailable, etc.)' })
  @IsOptional()
  @IsString()
  manualPunchReason?: string;

  @ApiProperty({ example: 28.6139 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 77.209 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Optional device metadata (browser, OS, etc.). Max 4 KB when serialised.',
  })
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return value;
    const serialised = JSON.stringify(value);
    if (serialised.length > DEVICE_INFO_MAX_BYTES) {
      throw new BadRequestException(
        `deviceInfo must not exceed ${DEVICE_INFO_MAX_BYTES} bytes when serialised`,
      );
    }
    return value;
  })
  deviceInfo?: Record<string, unknown>;
}
