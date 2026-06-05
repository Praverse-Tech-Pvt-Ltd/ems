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
  getOwnerDashboard(@CurrentUser() user: { id: string; email: string }) {
    return this.service.getOwnerDashboard(user.id, user.email);
  }

  @Post('weekly-summary')
  getWeeklySummary(@CurrentUser() user: { id: string; email: string }) {
    return this.service.getWeeklyAISummary(user.id, user.email);
  }

  @Get('employee-work-map')
  getEmployeeWorkMap(@CurrentUser() user: { id: string; email: string }) {
    return this.service.getEmployeeWorkMap(user.id, user.email);
  }
}
