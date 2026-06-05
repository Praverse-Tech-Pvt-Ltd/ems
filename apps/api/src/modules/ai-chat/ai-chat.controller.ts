import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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

  // Strict limit: 10 AI messages per minute per IP to protect Gemini API costs
  @Post('message')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  sendMessage(
    @Body() dto: { sessionId: string; question: string },
    @CurrentUser() user: { id: string; email: string },
  ) {
    if (!dto.sessionId || !dto.question?.trim()) {
      throw new Error('sessionId and question are required');
    }
    if (dto.question.length > 2000) {
      throw new Error('Question too long (max 2000 characters)');
    }
    return this.service.sendMessage(dto.sessionId, dto.question.trim(), user.id, user.email);
  }

  @Get('history/:sessionId')
  getHistory(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.service.getHistory(sessionId, user.id, user.email);
  }

  @Delete('history/:sessionId')
  clearHistory(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { id: string; email: string },
  ) {
    return this.service.clearHistory(sessionId, user.id, user.email);
  }
}
