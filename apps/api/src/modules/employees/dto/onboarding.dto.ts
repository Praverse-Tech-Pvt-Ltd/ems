import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class UpdateMyBankDetailsDto {
  @IsString()
  bankName: string;

  @IsString()
  accountNumber: string;

  @IsString()
  ifsc: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  @Length(10, 10)
  panNumber?: string;

  @IsOptional()
  @IsString()
  @Length(4, 4)
  aadhaarLast4?: string;
}

export class SubmitMyDocumentDto {
  @IsIn(['AADHAAR', 'PAN', 'PHOTO', 'FACE_CAPTURE'])
  docType: string;

  @IsString()
  fileS3Key: string;
}
