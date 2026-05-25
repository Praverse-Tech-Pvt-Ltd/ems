import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateRequestDto, UpdateRequestStatusDto } from './dto/create-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestsController {
  constructor(private service: RequestsService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateRequestDto,
  ) {
    return this.service.create(user.id, dto.requestType, dto.details);
  }

  @Get('my')
  findMy(@CurrentUser() user: { id: string }) {
    return this.service.findMy(user.id);
  }

  @Get()
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  /** Ownership-checked: employees can only see their own request. */
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/approve')
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.service.updateStatus(id, user.id, dto.status, dto.comment);
  }
}
