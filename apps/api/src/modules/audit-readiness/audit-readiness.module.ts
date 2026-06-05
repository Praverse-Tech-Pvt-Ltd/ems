import { Module } from '@nestjs/common';
import { AuditReadinessController } from './audit-readiness.controller';
import { AuditReadinessService } from './audit-readiness.service';
import { AIOverviewModule } from '../ai-overview/ai-overview.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [AIOverviewModule, StorageModule],
  controllers: [AuditReadinessController],
  providers: [AuditReadinessService],
  exports: [AuditReadinessService],
})
export class AuditReadinessModule {}
