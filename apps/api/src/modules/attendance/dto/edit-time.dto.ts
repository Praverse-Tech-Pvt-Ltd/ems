import { IsString, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EditTimeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  punchInTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  punchOutTime?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}
