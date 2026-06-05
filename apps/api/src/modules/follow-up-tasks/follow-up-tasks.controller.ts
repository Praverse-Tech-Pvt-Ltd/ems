import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FollowUpTasksService } from './follow-up-tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('follow-up-tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('follow-up-tasks')
export class FollowUpTasksController {
  constructor(private readonly service: FollowUpTasksService) {}

  @Get()
  findAll(@Query() query: any, @CurrentUser('id') userId: string) {
    return this.service.findAll({
      status: query.status,
      companyId: query.companyId,
      assignedToMe: query.assignedToMe === 'true',
      employeeId: userId,
    });
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Patch(':id/complete')
  complete(
    @Param('id') id: string,
    @Body('completionNote') note: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.complete(id, note ?? '', userId);
  }

  @Patch(':id/snooze')
  snooze(@Param('id') id: string, @Body('snoozedUntil') date: string) {
    return this.service.snooze(id, date);
  }

  @Post('run-check')
  @Roles('ADMIN', 'SUPER_ADMIN')
  runCheck() {
    return this.service.runFollowUpCheck();
  }
}
