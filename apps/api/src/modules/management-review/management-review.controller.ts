import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ManagementReviewService } from './management-review.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('management-review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
@Controller('management-review')
export class ManagementReviewController {
  constructor(private readonly service: ManagementReviewService) {}

  @Get('weekly')
  getWeeklyReview() {
    return this.service.getWeeklyReview();
  }

  @Get('ai-recommendations')
  getAIRecommendations() {
    return this.service.getAIRecommendations();
  }
}
