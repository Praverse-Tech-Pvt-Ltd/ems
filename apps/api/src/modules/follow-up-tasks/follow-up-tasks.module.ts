import { Module } from '@nestjs/common';
import { FollowUpTasksController } from './follow-up-tasks.controller';
import { FollowUpTasksService } from './follow-up-tasks.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [FollowUpTasksController],
  providers: [FollowUpTasksService],
  exports: [FollowUpTasksService],
})
export class FollowUpTasksModule {}
