import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAttendancePolicyDto {
  @ApiPropertyOptional({ description: 'Late punch-ins allowed per month before escalating to HALF_DAY.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(31)
  maxLatePerMonth?: number;

  @ApiPropertyOptional({ description: 'Early punch-outs allowed per month before escalating to HALF_DAY.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(31)
  maxEarlyOutPerMonth?: number;

  @ApiPropertyOptional({ description: 'Half-days allowed per month before escalating to LEAVE.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(31)
  maxHalfDaysPerMonth?: number;
}
