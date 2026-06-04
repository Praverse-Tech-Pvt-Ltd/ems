import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsEmail, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientCompanyDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shortName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() industry?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() contactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(['ACTIVE','DELAYED','AT_RISK','LOST','DORMANT']) businessStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(['HIGH','MEDIUM','LOW']) criticality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currentStage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibleEmployeeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() lastVisitDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() lastCommunicationDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() nextAuditDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
