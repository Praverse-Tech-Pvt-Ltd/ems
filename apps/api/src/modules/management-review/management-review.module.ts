import { Module } from '@nestjs/common';
import { ManagementReviewController } from './management-review.controller';
import { ManagementReviewService } from './management-review.service';
import { AIOverviewModule } from '../ai-overview/ai-overview.module';

@Module({
  imports: [AIOverviewModule],
  controllers: [ManagementReviewController],
  providers: [ManagementReviewService],
})
export class ManagementReviewModule {}
