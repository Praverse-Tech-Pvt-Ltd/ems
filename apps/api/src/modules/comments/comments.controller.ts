import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto, GetCommentsDto, CommentResourceType } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private service: CommentsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateCommentDto,
  ) {
    return this.service.create(
      user.id,
      dto.body,
      dto.resourceType as string as Parameters<CommentsService['create']>[2],
      dto.resourceId,
    );
  }

  @Get()
  findByResource(@Query() query: GetCommentsDto) {
    return this.service.findByResource(
      query.resourceType as string as Parameters<CommentsService['findByResource']>[0],
      query.resourceId,
    );
  }
}
