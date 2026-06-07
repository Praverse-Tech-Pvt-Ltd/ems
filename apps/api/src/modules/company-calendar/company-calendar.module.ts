import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CompanyCalendarController } from './company-calendar.controller';
import { CompanyCalendarService } from './company-calendar.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CompanyCalendarController],
  providers: [CompanyCalendarService],
  exports: [CompanyCalendarService],
})
export class CompanyCalendarModule {}
