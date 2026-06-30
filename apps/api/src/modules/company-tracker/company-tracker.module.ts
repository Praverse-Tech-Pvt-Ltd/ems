import { Module } from '@nestjs/common';
import { CompanyTrackerController } from './company-tracker.controller';
import { CompanyTrackerService } from './company-tracker.service';

@Module({
  controllers: [CompanyTrackerController],
  providers: [CompanyTrackerService],
})
export class CompanyTrackerModule {}
