import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AIProposalsService } from './ai-proposals.service';

@ApiTags('ai-proposals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai-proposals')
export class AIProposalsController {
  constructor(private readonly service: AIProposalsService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  findAll(@Query() query: any) {
    return this.service.findAll({
      status: query.status,
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 30,
    });
  }

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN')
  approve(
    @Param('id') id: string,
    @Body('corrections') corrections: Record<string, any> | undefined,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.service.approve(id, user, corrections);
  }

  @Patch(':id/reject')
  @Roles('SUPER_ADMIN')
  reject(
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.service.reject(id, user, reason);
  }
}
