import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClientCommunicationsService } from './client-communications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('client-communications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('client-communications')
export class ClientCommunicationsController {
  constructor(private readonly service: ClientCommunicationsService) {}

  @Get(':companyId')
  findAll(
    @Param('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(companyId, page ? parseInt(page) : 1, limit ? parseInt(limit) : 30);
  }

  @Post(':companyId')
  create(
    @Param('companyId') companyId: string,
    @Body() dto: any,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.create(companyId, dto, userId);
  }

  @Patch(':companyId/:id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':companyId/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
