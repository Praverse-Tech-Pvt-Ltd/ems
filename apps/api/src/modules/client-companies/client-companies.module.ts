import { Module } from '@nestjs/common';
import { ClientCompaniesController } from './client-companies.controller';
import { ClientCompaniesService } from './client-companies.service';
import { AIOverviewModule } from '../ai-overview/ai-overview.module';

@Module({
  imports: [AIOverviewModule],
  controllers: [ClientCompaniesController],
  providers: [ClientCompaniesService],
  exports: [ClientCompaniesService],
})
export class ClientCompaniesModule {}
