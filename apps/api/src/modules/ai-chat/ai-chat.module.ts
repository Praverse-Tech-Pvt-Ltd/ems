import { Module } from '@nestjs/common';
import { AIChatController } from './ai-chat.controller';
import { AIChatService } from './ai-chat.service';
import { AIOverviewModule } from '../ai-overview/ai-overview.module';

@Module({
  imports: [AIOverviewModule],
  controllers: [AIChatController],
  providers: [AIChatService],
})
export class AIChatModule {}
