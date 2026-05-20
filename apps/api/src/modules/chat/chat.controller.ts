import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get('channels')
  @ApiOperation({ summary: 'Get my channels with last message and unread count' })
  getMyChannels(@CurrentUser() user: { id: string }) {
    return this.service.getMyChannels(user.id);
  }

  @Post('channels/direct')
  @ApiOperation({ summary: 'Get or create a direct message channel' })
  getOrCreateDirect(
    @CurrentUser() user: { id: string },
    @Body('otherId') otherId: string,
  ) {
    return this.service.getOrCreateDirect(user.id, otherId);
  }

  @Post('channels/group')
  @ApiOperation({ summary: 'Create a group channel' })
  createGroup(
    @CurrentUser() user: { id: string },
    @Body() body: { name: string; memberIds: string[] },
  ) {
    return this.service.createGroup(body.name, body.memberIds, user.id);
  }

  @Get('channels/:id/messages')
  @ApiOperation({ summary: 'Get paginated messages for a channel' })
  getMessages(
    @CurrentUser() user: { id: string },
    @Param('id') channelId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getMessages(channelId, user.id, cursor, limit ? parseInt(limit, 10) : 30);
  }

  @Patch('channels/:id/read')
  @ApiOperation({ summary: 'Mark all messages in channel as read' })
  markRead(
    @CurrentUser() user: { id: string },
    @Param('id') channelId: string,
  ) {
    return this.service.markRead(channelId, user.id);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete own message' })
  deleteMessage(
    @CurrentUser() user: { id: string },
    @Param('id') messageId: string,
  ) {
    return this.service.deleteMessage(messageId, user.id);
  }
}
