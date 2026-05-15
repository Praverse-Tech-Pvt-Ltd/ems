import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestType } from '@prisma/client';

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private service: RequestsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() body: { requestType: RequestType; details: Record<string, unknown> },
  ) {
    return this.service.create(user.id, body.requestType, body.details);
  }

  @Get('my')
  findMy(@CurrentUser() user: { id: string }) {
    return this.service.findMy(user.id);
  }

  @Get()
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/approve')
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { status: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW'; comment?: string },
  ) {
    return this.service.updateStatus(id, user.id, body.status, body.comment);
  }
}
