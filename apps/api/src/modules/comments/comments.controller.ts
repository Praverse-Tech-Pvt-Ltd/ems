import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type ResourceType = 'expense' | 'invoice' | 'leaveRequest' | 'employeeRequest';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private service: CommentsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() body: { body: string; resourceType: ResourceType; resourceId: string },
  ) {
    return this.service.create(user.id, body.body, body.resourceType, body.resourceId);
  }

  @Get()
  findByResource(
    @Query('resourceType') resourceType: ResourceType,
    @Query('resourceId') resourceId: string,
  ) {
    return this.service.findByResource(resourceType, resourceId);
  }
}
