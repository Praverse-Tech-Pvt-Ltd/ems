import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorporateService } from './corporate.service';

@ApiTags('Corporate')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('corporate')
export class CorporateController {
  constructor(private service: CorporateService) {}

  @Get('settings')
  settings() {
    return this.service.settings();
  }

  @Post('settings/:key')
  @Roles('ADMIN', 'SUPER_ADMIN')
  upsertSetting(@CurrentUser() user: { id: string }, @Param('key') key: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertSetting(user.id, key, body);
  }

  @Get('holidays')
  holidays() {
    return this.service.holidays();
  }

  @Post('holidays')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createHoliday(@CurrentUser() user: { id: string }, @Body() body: Record<string, unknown>) {
    return this.service.createHoliday(user.id, body);
  }

  @Delete('holidays/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteHoliday(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.deleteHoliday(user.id, id);
  }

  @Get('policies')
  policies(@CurrentUser() user: { id: string }, @Query('includeDrafts') includeDrafts?: string) {
    return this.service.policies(user.id, includeDrafts === 'true');
  }

  @Post('policies')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createPolicy(@CurrentUser() user: { id: string }, @Body() body: Record<string, unknown>) {
    return this.service.createPolicy(user.id, body);
  }

  @Post('policies/:id/acknowledge')
  acknowledgePolicy(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.acknowledgePolicy(user.id, id);
  }

  @Get('tasks/my')
  myTasks(@CurrentUser() user: { id: string }) {
    return this.service.myTasks(user.id);
  }

  @Get('tasks')
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminTasks() {
    return this.service.adminTasks();
  }

  @Post('tasks')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createTask(@CurrentUser() user: { id: string }, @Body() body: Record<string, unknown>) {
    return this.service.createTask(user.id, body);
  }

  @Patch('tasks/my/:assignmentId/complete')
  completeTask(@CurrentUser() user: { id: string }, @Param('assignmentId') assignmentId: string) {
    return this.service.completeTask(user.id, assignmentId);
  }

  @Get('chat/channels')
  channels(@CurrentUser() user: { id: string; role?: string }) {
    return this.service.channels(user);
  }

  @Post('chat/channels')
  createChannel(@CurrentUser() user: { id: string }, @Body() body: Record<string, unknown>) {
    return this.service.createChannel(user.id, body);
  }

  @Get('chat/channels/:id/messages')
  messages(@CurrentUser() user: { id: string; role?: string }, @Param('id') id: string) {
    return this.service.messages(user, id);
  }

  @Post('chat/channels/:id/messages')
  sendMessage(@CurrentUser() user: { id: string; role?: string }, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.sendMessage(user, id, body);
  }

  @Get('lifecycle')
  @Roles('ADMIN', 'SUPER_ADMIN')
  lifecycle(@Query('employeeId') employeeId?: string) {
    return this.service.lifecycle(employeeId);
  }

  @Get('lifecycle/my')
  myLifecycle(@CurrentUser() user: { id: string }) {
    return this.service.lifecycle(user.id);
  }

  @Post('lifecycle')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createLifecycle(@CurrentUser() user: { id: string }, @Body() body: Record<string, unknown>) {
    return this.service.createLifecycle(user.id, body);
  }
}
