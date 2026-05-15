import { IsString, IsInt, IsNumber, Min, Max } from 'class-validator';

export class CreateSalarySlipDto {
  @IsString()
  employeeId: string;

  @IsInt() @Min(1) @Max(12)
  month: number;

  @IsInt() @Min(2020)
  year: number;

  @IsNumber()
  grossSalary: number;

  @IsNumber()
  deductions: number;

  @IsInt() @Min(0)
  lopDays: number;

  @IsInt() @Min(0)
  daysPresent: number;

  @IsString()
  slipPdfS3Key: string;
}
