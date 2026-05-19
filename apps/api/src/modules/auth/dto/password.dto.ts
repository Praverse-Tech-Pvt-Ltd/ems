import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john.doe@nexgen.in' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'NewSecurePass@123' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
