import { Controller, Get, Post, Delete, Body, Param, UseGuards, BadRequestException } from '@nestjs/common';
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
    @CurrentUser() user: { id: string; email: string; role: string },
  ) {
    if (!dto.sessionId || !dto.question?.trim()) {
      throw new BadRequestException('sessionId and question are required');
    }
    if (dto.question.length > 2000) {
      throw new BadRequestException('Question too long (max 2000 characters)');
    }
    return this.service.sendMessage(dto.sessionId, dto.question.trim(), user.id, user.role);
  }

  @Get('history/:sessionId')
  getHistory(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { id: string; email: string; role: string },
  ) {
    return this.service.getHistory(sessionId, user.id, user.role);
  }

  @Delete('history/:sessionId')
  clearHistory(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: { id: string; email: string; role: string },
  ) {
    return this.service.clearHistory(sessionId, user.id, user.role);
  }
}
