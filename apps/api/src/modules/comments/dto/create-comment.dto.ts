import {
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CommentResourceType {
  EXPENSE = 'expense',
  INVOICE = 'invoice',
  LEAVE_REQUEST = 'leaveRequest',
  EMPLOYEE_REQUEST = 'employeeRequest',
}

export class CreateCommentDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @ApiProperty({ enum: CommentResourceType })
  @IsEnum(CommentResourceType)
  resourceType: CommentResourceType;

  @ApiProperty({ description: 'UUID of the resource being commented on' })
  @IsUUID()
  resourceId: string;
}

export class GetCommentsDto {
  @ApiProperty({ enum: CommentResourceType })
  @IsEnum(CommentResourceType)
  resourceType: CommentResourceType;

  @ApiProperty({ description: 'UUID of the resource' })
  @IsUUID()
  resourceId: string;
}
