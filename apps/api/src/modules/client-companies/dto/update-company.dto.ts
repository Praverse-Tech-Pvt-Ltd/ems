import { PartialType } from '@nestjs/swagger';
import { CreateClientCompanyDto } from './create-company.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateClientCompanyDto extends PartialType(CreateClientCompanyDto) {
  @IsOptional() @IsBoolean() isArchived?: boolean;
  @IsOptional() @IsString() archivedReason?: string;
}
