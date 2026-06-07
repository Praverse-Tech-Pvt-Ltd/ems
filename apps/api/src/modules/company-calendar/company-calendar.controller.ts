import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyCalendarService } from './company-calendar.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('company-calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('company-calendar')
export class CompanyCalendarController {
  constructor(private readonly service: CompanyCalendarService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  create(@Body() dto: any, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get('upcoming')
  upcoming(@Query('days') days?: string) {
    return this.service.findUpcoming(days ? parseInt(days) : 30);
  }

  @Get('audit-countdowns')
  auditCountdowns() {
    return this.service.getAuditCountdowns();
  }

  @Get('regulatory')
  findRegulatory(@Query('companyId') companyId?: string) {
    return this.service.findRegulatory(companyId);
  }

  @Post('seed-regulatory')
  @Roles('ADMIN', 'SUPER_ADMIN')
  seedRegulatory(@CurrentUser('id') userId: string) {
    return this.service.seedRegulatoryEvents(userId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.service.remove(id, userId);
  }
}
