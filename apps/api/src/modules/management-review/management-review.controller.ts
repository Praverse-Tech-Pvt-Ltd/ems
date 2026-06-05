import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
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

  @Get('employee-performance')
  getEmployeePerformance(@Query('days') days?: string) {
    return this.service.getEmployeePerformanceReport(days ? parseInt(days) : 30);
  }

  @Get('export/pdf')
  async exportPdf(@Res() res: Response) {
    const buffer = await this.service.exportPdf();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="management-review-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(buffer);
  }

  @Get('export/excel')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.service.exportExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="company-status-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);
  }
}
