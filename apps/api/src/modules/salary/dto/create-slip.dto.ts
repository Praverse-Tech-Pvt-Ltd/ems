import { IsString, IsInt, IsNumber, IsUUID, Min, Max, IsOptional, IsEnum } from 'class-validator';

export class CreateSalarySlipDto {
  @IsUUID()
  employeeId: string;

  @IsInt() @Min(1) @Max(12)
  month: number;

  @IsInt() @Min(2020)
  year: number;

  @IsNumber()
  grossSalary: number;

  @IsOptional()
  @IsNumber()
  baseSalary?: number;

  @IsOptional()
  @IsNumber()
  incentives?: number;

  @IsOptional()
  @IsNumber()
  reimbursements?: number;

  @IsNumber()
  deductions: number;

  @IsNumber()
  netPayable: number;

  @IsInt() @Min(0)
  lopDays: number;

  @IsInt() @Min(0)
  daysPresent: number;

  @IsString()
  slipPdfS3Key: string;

  @IsOptional()
  @IsString()
  signatureName?: string;

  @IsOptional()
  @IsString()
  signatureTitle?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpsertSalaryStructureDto {
  @IsNumber()
  basic: number;

  @IsOptional()
  @IsNumber()
  hra?: number;

  @IsOptional()
  @IsNumber()
  allowances?: number;

  @IsOptional()
  @IsNumber()
  pfDeduction?: number;

  @IsOptional()
  @IsNumber()
  professionalTax?: number;

  @IsOptional()
  @IsNumber()
  tds?: number;

  @IsString()
  effectiveFrom: string;

  @IsOptional()
  @IsString()
  signatureName?: string;

  @IsOptional()
  @IsString()
  signatureTitle?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateSalarySlipDto {
  @IsUUID()
  employeeId: string;

  @IsInt() @Min(1) @Max(12)
  month: number;

  @IsInt() @Min(2020)
  year: number;

  @IsOptional()
  @IsNumber()
  incentives?: number;

  @IsOptional()
  @IsNumber()
  deductions?: number;

  @IsOptional()
  @IsInt() @Min(0)
  lopDays?: number;

  @IsOptional()
  @IsInt() @Min(0)
  daysPresent?: number;

  @IsOptional()
  @IsString()
  signatureName?: string;

  @IsOptional()
  @IsString()
  signatureTitle?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GeneratePayrollRunDto {
  @IsInt() @Min(1) @Max(12)
  month: number;

  @IsInt() @Min(2020)
  year: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReconcilePayrollRunDto {
  @IsEnum(['WAGE_SHEET', 'EPF_ECR', 'ESIC_ECR'])
  documentType: 'WAGE_SHEET' | 'EPF_ECR' | 'ESIC_ECR';
}

export class TransferSalarySlipDto {
  @IsOptional()
  @IsString()
  paymentRef?: string;
}

export class RejectSalarySlipDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
