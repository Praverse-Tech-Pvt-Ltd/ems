import { IsEnum, IsString, IsDateString, MinLength } from 'class-validator';

enum LeaveType { CL = 'CL', SL = 'SL', PL = 'PL', UL = 'UL', CO = 'CO' }

export class CreateLeaveDto {
  @IsEnum(LeaveType)
  leaveType: LeaveType;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsString()
  @MinLength(3)
  reason: string;
}
