import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

import { GeoFenceService } from './geo-fence.service';
import { AttendanceCronService } from './attendance-cron.service';
import { AttendanceBalanceService } from './attendance-balance.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,

    GeoFenceService,
    AttendanceCronService,
    AttendanceBalanceService,
  ],
  exports: [AttendanceService, AttendanceBalanceService],
})
export class AttendanceModule {}
