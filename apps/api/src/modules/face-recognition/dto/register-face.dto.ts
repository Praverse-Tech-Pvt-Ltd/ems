import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterFaceDto {
  @ApiProperty({ description: 'Employee ID to register face for' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'Base64-encoded image (data URI or raw base64)' })
  @IsString()
  @IsNotEmpty()
  imageBase64: string;
}
