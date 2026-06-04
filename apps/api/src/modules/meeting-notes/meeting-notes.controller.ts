import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MeetingNotesService } from './meeting-notes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('meeting-notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('meeting-notes')
export class MeetingNotesController {
  constructor(private readonly service: MeetingNotesService) {}

  @Post()
  create(
    @Body() dto: { rawText: string; meetingDate: string; companyId?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(dto, userId);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.service.findAll({
      companyId: query.companyId,
      needsReview: query.needsReview === 'true',
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    });
  }

  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.service.adminReview(id, userId, role, dto.corrections);
  }
}
