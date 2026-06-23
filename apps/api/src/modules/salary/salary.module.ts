import { Module } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { SalaryController } from './salary.controller';
import { SalaryCronService } from './salary-cron.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [AttendanceModule],
  controllers: [SalaryController],
  providers: [SalaryService, SalaryCronService],
})
export class SalaryModule {}
