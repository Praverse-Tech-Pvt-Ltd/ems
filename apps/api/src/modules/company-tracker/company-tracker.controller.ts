import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CompanyTrackerService } from './company-tracker.service';

type UserCtx = { id: string; role: string };

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company-tracker')
export class CompanyTrackerController {
  constructor(private readonly service: CompanyTrackerService) {}

  @Get('options')
  options() {
    return this.service.options();
  }

  @Get('dashboard')
  dashboard(@CurrentUser() user: UserCtx, @Query() query: Record<string, string>) {
    return this.service.dashboard(user, query);
  }

  @Get('projects')
  listProjects(@CurrentUser() user: UserCtx, @Query() query: Record<string, string>) {
    return this.service.listProjects(user, query);
  }

  @Post('projects')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createProject(@CurrentUser() user: UserCtx, @Body() dto: Record<string, unknown>) {
    return this.service.createProject(user, dto);
  }

  @Get('projects/:id')
  getProject(@CurrentUser() user: UserCtx, @Param('id') id: string) {
    return this.service.getProject(user, id);
  }

  @Patch('projects/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateProject(@CurrentUser() user: UserCtx, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.service.updateProject(user, id, dto);
  }

  @Delete('projects/:id')
  @Roles('SUPER_ADMIN')
  deleteProject(@CurrentUser() user: UserCtx, @Param('id') id: string) {
    return this.service.deleteProject(user, id);
  }

  @Post('projects/:id/requirements')
  @Roles('ADMIN', 'SUPER_ADMIN')
  addRequirement(@CurrentUser() user: UserCtx, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.service.addRequirement(user, id, dto);
  }

  @Patch('requirements/:id')
  updateRequirement(@CurrentUser() user: UserCtx, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.service.updateRequirement(user, id, dto);
  }

  @Post('requirements/:id/documents')
  addDocument(@CurrentUser() user: UserCtx, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.service.addDocument(user, id, dto);
  }

  @Post('follow-ups')
  createFollowUp(@CurrentUser() user: UserCtx, @Body() dto: Record<string, unknown>) {
    return this.service.createFollowUp(user, dto);
  }

  @Patch('follow-ups/:id')
  updateFollowUp(@CurrentUser() user: UserCtx, @Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.service.updateFollowUp(user, id, dto);
  }

  @Get('reports/:type')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async exportReport(
    @CurrentUser() user: UserCtx,
    @Param('type') type: string,
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const report = await this.service.exportReport(user, type, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.send(report.csv);
  }
}
