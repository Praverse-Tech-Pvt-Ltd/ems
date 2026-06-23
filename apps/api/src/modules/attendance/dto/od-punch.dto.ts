import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OdPunchInDto {
  @ApiProperty()
  @IsDateString()
  punchInTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class OdPunchOutDto {
  @ApiProperty()
  @IsDateString()
  punchOutTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
