import { Module } from '@nestjs/common';
import { WorkUpdatesController } from './work-updates.controller';
import { WorkUpdatesService } from './work-updates.service';
import { AIOverviewModule } from '../ai-overview/ai-overview.module';
import { AIProposalsModule } from '../ai-proposals/ai-proposals.module';

@Module({
  imports: [AIOverviewModule, AIProposalsModule],
  controllers: [WorkUpdatesController],
  providers: [WorkUpdatesService],
})
export class WorkUpdatesModule {}
