import { Module } from '@nestjs/common';
import { MeetingNotesController } from './meeting-notes.controller';
import { MeetingNotesService } from './meeting-notes.service';
import { AIOverviewModule } from '../ai-overview/ai-overview.module';
import { AIProposalsModule } from '../ai-proposals/ai-proposals.module';

@Module({
  imports: [AIOverviewModule, AIProposalsModule],
  controllers: [MeetingNotesController],
  providers: [MeetingNotesService],
})
export class MeetingNotesModule {}
