import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkUpdatesService } from './work-updates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('work-updates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('work-updates')
export class WorkUpdatesController {
  constructor(private readonly service: WorkUpdatesService) {}

  @Post()
  create(
    @Body() dto: { rawText: string; updateDate: string; companyId?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(dto, userId);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.service.findAll({
      companyId: query.companyId,
      employeeId: query.employeeId,
      needsReview: query.needsReview === 'true',
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 20,
    });
  }

  @Get('my')
  getMyUpdates(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getMyUpdates(userId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 20);
  }

  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body('status') status: 'APPROVED' | 'NEEDS_CORRECTION',
    @CurrentUser('id') userId: string,
  ) {
    return this.service.review(id, userId, status);
  }
}
