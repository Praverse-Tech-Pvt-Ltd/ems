import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { AIOverviewController } from './ai-overview.controller';
import { AIOverviewService } from './ai-overview.service';

@Module({
  controllers: [AIOverviewController],
  providers: [AIOverviewService, GeminiService],
  exports: [GeminiService],
})
export class AIOverviewModule {}
