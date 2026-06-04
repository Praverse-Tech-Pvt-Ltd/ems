import { Module } from '@nestjs/common';
import { CompanyCalendarController } from './company-calendar.controller';
import { CompanyCalendarService } from './company-calendar.service';

@Module({
  controllers: [CompanyCalendarController],
  providers: [CompanyCalendarService],
  exports: [CompanyCalendarService],
})
export class CompanyCalendarModule {}
