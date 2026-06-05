import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditReadinessService } from './audit-readiness.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('audit-readiness')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-readiness')
export class AuditReadinessController {
  constructor(private readonly service: AuditReadinessService) {}

  @Get(':projectId')
  getReadiness(@Param('projectId') projectId: string) {
    return this.service.getReadiness(projectId);
  }

  @Post(':projectId/items')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  createItem(@Param('projectId') projectId: string, @Body() dto: any) {
    return this.service.createItem(projectId, dto);
  }

  @Patch(':projectId/items/:itemId')
  updateItem(
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @Body() dto: any,
  ) {
    return this.service.updateItem(projectId, itemId, dto);
  }

  @Delete(':projectId/items/:itemId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteItem(@Param('itemId') itemId: string) {
    return this.service.deleteItem(itemId);
  }

  @Post(':projectId/seed')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  seedChecklist(
    @Param('projectId') projectId: string,
    @Body('auditType') auditType: string,
  ) {
    return this.service.seedChecklist(projectId, auditType);
  }

  @Post(':projectId/ai-gaps')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  generateAIGaps(@Param('projectId') projectId: string) {
    return this.service.generateAIGaps(projectId);
  }

  @Get(':projectId/export/pdf')
  async exportPdf(@Param('projectId') projectId: string, @Res() res: Response) {
    const buffer = await this.service.exportPdf(projectId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="audit-readiness-${projectId}.pdf"`);
    res.send(buffer);
  }
}
