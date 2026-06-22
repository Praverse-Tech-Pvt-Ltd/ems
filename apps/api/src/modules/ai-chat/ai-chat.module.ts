import { Module } from '@nestjs/common';
import { AIChatController } from './ai-chat.controller';
import { AIChatService } from './ai-chat.service';
import { AIOverviewModule } from '../ai-overview/ai-overview.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CompanyCalendarModule } from '../company-calendar/company-calendar.module';
import { AIProposalsModule } from '../ai-proposals/ai-proposals.module';

@Module({
  imports: [AIOverviewModule, NotificationsModule, CompanyCalendarModule, AIProposalsModule],
  controllers: [AIChatController],
  providers: [AIChatService],
})
export class AIChatModule {}
