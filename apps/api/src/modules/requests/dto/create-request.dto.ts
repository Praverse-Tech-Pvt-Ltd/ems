import { IsEnum, IsObject, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestType } from '@prisma/client';

export class CreateRequestDto {
  @ApiProperty({ enum: RequestType })
  @IsEnum(RequestType)
  requestType: RequestType;

  @ApiProperty({ description: 'Freeform details specific to the request type' })
  @IsObject()
  details: Record<string, unknown>;
}

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'UNDER_REVIEW'] })
  @IsIn(['APPROVED', 'REJECTED', 'UNDER_REVIEW'])
  status: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
