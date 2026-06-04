import { Module } from '@nestjs/common';
import { WorkUpdatesController } from './work-updates.controller';
import { WorkUpdatesService } from './work-updates.service';
import { AIOverviewModule } from '../ai-overview/ai-overview.module';

@Module({
  imports: [AIOverviewModule],
  controllers: [WorkUpdatesController],
  providers: [WorkUpdatesService],
})
export class WorkUpdatesModule {}
