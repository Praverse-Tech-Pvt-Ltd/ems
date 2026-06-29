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
import { LeavesService } from './leaves.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private service: LeavesService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateLeaveDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Get('my')
  findMy(@CurrentUser() user: { id: string }) {
    return this.service.findMy(user.id);
  }

  @Get('balance')
  getBalance(@CurrentUser() user: { id: string }) {
    return this.service.getBalance(user.id);
  }

  @Get('employee/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  findByEmployee(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findByEmployee(id);
  }

  @Get()
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  @Patch(':id/approve')
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.service.approve(id, user.id, dto.action, dto.rejectionReason);
  }
}
