import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveLeaveDto {
  @ApiProperty({ enum: ['approve', 'reject', 'APPROVE', 'REJECT'] })
  @IsIn(['approve', 'reject', 'APPROVE', 'REJECT'])
  action: 'approve' | 'reject' | 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}
