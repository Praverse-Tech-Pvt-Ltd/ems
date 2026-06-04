import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AIOverviewService } from './ai-overview.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('ai-overview')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-overview')
export class AIOverviewController {
  constructor(private readonly service: AIOverviewService) {}

  @Get('owner-dashboard')
  getOwnerDashboard(@CurrentUser('id') userId: string) {
    return this.service.getOwnerDashboard(userId);
  }

  @Post('weekly-summary')
  getWeeklySummary(@CurrentUser('id') userId: string) {
    return this.service.getWeeklyAISummary(userId);
  }

  @Get('employee-work-map')
  getEmployeeWorkMap(@CurrentUser('id') userId: string) {
    return this.service.getEmployeeWorkMap(userId);
  }
}
