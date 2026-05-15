import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private service: LeavesService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() body: Parameters<LeavesService['create']>[1],
  ) {
    return this.service.create(user.id, body);
  }

  @Get('my')
  findMy(@CurrentUser() user: { id: string }) {
    return this.service.findMy(user.id);
  }

  @Get('balance')
  getBalance(@CurrentUser() user: { id: string }) {
    return this.service.getBalance(user.id);
  }

  @Get()
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  @Patch(':id/approve')
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() body: { action: 'approve' | 'reject'; rejectionReason?: string },
  ) {
    return this.service.approve(id, user.id, body.action, body.rejectionReason);
  }
}
