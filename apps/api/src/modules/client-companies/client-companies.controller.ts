import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ClientCompaniesService } from './client-companies.service';
import { CreateClientCompanyDto } from './dto/create-company.dto';
import { UpdateClientCompanyDto } from './dto/update-company.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('client-companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('client-companies')
export class ClientCompaniesController {
  constructor(private readonly service: ClientCompaniesService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  create(@Body() dto: CreateClientCompanyDto, @CurrentUser('id') userId: string) {
    return this.service.create(dto, userId);
  }

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'criticality', required: false })
  @ApiQuery({ name: 'archived', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'responsible', required: false })
  findAll(@Query() query: any) {
    return this.service.findAll({
      status: query.status,
      criticality: query.criticality,
      archived: query.archived === 'true',
      search: query.search,
      responsible: query.responsible,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateClientCompanyDto, @CurrentUser('id') userId: string) {
    return this.service.update(id, dto, userId);
  }

  @Post(':id/ai-summary')
  generateAISummary(@Param('id') id: string) {
    return this.service.generateAISummary(id);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.service.getTimeline(id, limit ? parseInt(limit) : 50);
  }

  @Post(':id/visits')
  addVisit(
    @Param('id') id: string,
    @Body() dto: { visitDate: string; purpose?: string; outcome?: string; nextSteps?: string; followUpDate?: string },
    @CurrentUser('id') userId: string,
  ) {
    return this.service.addVisit(id, dto, userId);
  }

  @Post('run-alert-check')
  @Roles('ADMIN', 'SUPER_ADMIN')
  runAlertCheck() {
    return this.service.runAlertCheck();
  }
}
