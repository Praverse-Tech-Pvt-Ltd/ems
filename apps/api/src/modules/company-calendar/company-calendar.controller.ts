import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CompanyCalendarService } from './company-calendar.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('company-calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('company-calendar')
export class CompanyCalendarController {
  constructor(private readonly service: CompanyCalendarService) {}

  @Post()
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

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
