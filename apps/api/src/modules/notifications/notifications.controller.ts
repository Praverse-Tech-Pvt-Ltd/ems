import { Controller, Get, Patch, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findMy(@CurrentUser() user: { id: string }) {
    return this.service.findMy(user.id);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.service.unreadCount(user.id);
    return { count };
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.service.markRead(id, user.id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.service.markAllRead(user.id);
  }

  @Post('broadcast')
  @Roles('ADMIN', 'SUPER_ADMIN')
  broadcast(@Body() body: { title: string; message: string }) {
    return this.service.broadcast(body.title, body.message);
  }
}
