import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

import { GeoFenceService } from './geo-fence.service';
import { AttendanceCronService } from './attendance-cron.service';

@Module({
  controllers: [AttendanceController],
  providers: [
    AttendanceService,

    GeoFenceService,
    AttendanceCronService,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
