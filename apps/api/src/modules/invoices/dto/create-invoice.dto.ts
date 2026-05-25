import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  invoiceNumber: string;

  @ApiProperty({ enum: ['VENDOR', 'CLIENT'] })
  @IsEnum(['VENDOR', 'CLIENT'])
  type: 'VENDOR' | 'CLIENT';

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  partyName: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  gstPercent?: number;

  @ApiProperty()
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'PAID'] })
  @IsEnum(['APPROVED', 'REJECTED', 'PAID'])
  status: 'APPROVED' | 'REJECTED' | 'PAID';

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  paymentRef?: string;
}
