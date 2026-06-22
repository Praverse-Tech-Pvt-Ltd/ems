import { Module } from '@nestjs/common';
import { AIProposalsController } from './ai-proposals.controller';
import { AIProposalsService } from './ai-proposals.service';
import { CompanyCalendarModule } from '../company-calendar/company-calendar.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CompanyCalendarModule, NotificationsModule],
  controllers: [AIProposalsController],
  providers: [AIProposalsService],
  exports: [AIProposalsService],
})
export class AIProposalsModule {}
