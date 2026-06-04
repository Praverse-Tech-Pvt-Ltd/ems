import { Module } from '@nestjs/common';
import { MeetingNotesController } from './meeting-notes.controller';
import { MeetingNotesService } from './meeting-notes.service';
import { AIOverviewModule } from '../ai-overview/ai-overview.module';

@Module({
  imports: [AIOverviewModule],
  controllers: [MeetingNotesController],
  providers: [MeetingNotesService],
})
export class MeetingNotesModule {}
