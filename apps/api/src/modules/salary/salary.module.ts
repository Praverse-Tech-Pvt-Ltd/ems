import { Module } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { SalaryController } from './salary.controller';
import { SalaryCronService } from './salary-cron.service';

@Module({
  controllers: [SalaryController],
  providers: [SalaryService, SalaryCronService],
})
export class SalaryModule {}
