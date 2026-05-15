import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body: string;

  @IsUUID() @IsOptional()
  expenseId?: string;

  @IsUUID() @IsOptional()
  invoiceId?: string;

  @IsUUID() @IsOptional()
  leaveRequestId?: string;

  @IsUUID() @IsOptional()
  employeeRequestId?: string;

  @IsString() @IsOptional()
  attachmentS3Key?: string;
}
