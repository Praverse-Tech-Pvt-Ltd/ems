import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CorporateService } from './corporate.service';
import {
  CreateChannelDto,
  CreateHolidayDto,
  CreateLifecycleDto,
  CreatePolicyDto,
  CreateTaskDto,
  SendMessageDto,
  UpsertSettingDto,
} from './dto/corporate.dto';

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
  upsertSetting(
    @CurrentUser() user: { id: string },
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
  ) {
    return this.service.upsertSetting(user.id, key, dto.value);
  }

  @Get('holidays')
  holidays() {
    return this.service.holidays();
  }

  @Post('holidays')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createHoliday(@CurrentUser() user: { id: string }, @Body() dto: CreateHolidayDto) {
    return this.service.createHoliday(user.id, dto);
  }

  @Delete('holidays/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  deleteHoliday(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteHoliday(user.id, id);
  }

  @Get('policies')
  policies(
    @CurrentUser() user: { id: string },
    @Query('includeDrafts') includeDrafts?: string,
  ) {
    return this.service.policies(user.id, includeDrafts === 'true');
  }

  @Post('policies')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createPolicy(@CurrentUser() user: { id: string }, @Body() dto: CreatePolicyDto) {
    return this.service.createPolicy(user.id, dto);
  }

  @Post('policies/:id/acknowledge')
  acknowledgePolicy(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
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
  createTask(@CurrentUser() user: { id: string }, @Body() dto: CreateTaskDto) {
    return this.service.createTask(user.id, dto);
  }

  @Patch('tasks/my/:assignmentId/complete')
  completeTask(
    @CurrentUser() user: { id: string },
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.service.completeTask(user.id, assignmentId);
  }

  @Get('chat/channels')
  channels(@CurrentUser() user: { id: string; role?: string }) {
    return this.service.channels(user);
  }

  @Post('chat/channels')
  createChannel(@CurrentUser() user: { id: string }, @Body() dto: CreateChannelDto) {
    return this.service.createChannel(user.id, dto);
  }

  @Get('chat/channels/:id/messages')
  messages(
    @CurrentUser() user: { id: string; role?: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.messages(user, id);
  }

  @Post('chat/channels/:id/messages')
  sendMessage(
    @CurrentUser() user: { id: string; role?: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.service.sendMessage(user, id, dto.body);
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
  createLifecycle(@CurrentUser() user: { id: string }, @Body() dto: CreateLifecycleDto) {
    return this.service.createLifecycle(user.id, dto);
  }
}
