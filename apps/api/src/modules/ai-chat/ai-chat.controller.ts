import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AIChatService } from './ai-chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('ai-chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-chat')
export class AIChatController {
  constructor(private readonly service: AIChatService) {}

  @Post('message')
  sendMessage(
    @Body() dto: { sessionId: string; question: string },
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.service.sendMessage(dto.sessionId, dto.question, user.id, user.email);
  }

  @Get('history/:sessionId')
  getHistory(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.service.getHistory(sessionId, user.email);
  }

  @Delete('history/:sessionId')
  clearHistory(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.service.clearHistory(sessionId, user.email);
  }
}
