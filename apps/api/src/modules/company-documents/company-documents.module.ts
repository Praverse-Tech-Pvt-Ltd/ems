import { Module } from '@nestjs/common';
import { CompanyDocumentsController } from './company-documents.controller';
import { CompanyDocumentsService } from './company-documents.service';
import { StorageModule } from '../../common/storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [CompanyDocumentsController],
  providers: [CompanyDocumentsService],
  exports: [CompanyDocumentsService],
})
export class CompanyDocumentsModule {}
