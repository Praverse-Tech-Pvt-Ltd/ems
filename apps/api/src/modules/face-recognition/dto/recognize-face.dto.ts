import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RecognizeFaceDto {
  @ApiProperty({ description: 'Base64-encoded image to identify' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;
}

export class VerifyFaceDto {
  @ApiProperty({ description: 'Employee ID to verify against' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'Base64-encoded image to verify' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;
}
