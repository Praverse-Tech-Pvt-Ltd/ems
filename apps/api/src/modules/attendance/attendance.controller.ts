import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { PunchInDto } from './dto/punch-in.dto';
import { RegularizeDto } from './dto/regularize.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private service: AttendanceService) {}

  @Post('punch-in')
  punchIn(@CurrentUser() user: { id: string }, @Body() dto: PunchInDto) {
    return this.service.punchIn(user.id, dto);
  }

  @Post('punch-out')
  punchOut(@CurrentUser() user: { id: string }, @Body() dto: PunchInDto) {
    return this.service.punchOut(user.id, dto);
  }

  @Post('face/enroll')
  enrollFace(@CurrentUser() user: { id: string }, @Body() body: { frames?: string[] }) {
    return this.service.enrollFace(user.id, body.frames ?? []);
  }

  @Get('today')
  getToday(@CurrentUser() user: { id: string }) {
    return this.service.getToday(user.id);
  }

  @Get('my')
  getMy(
    @CurrentUser() user: { id: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getByEmployee(user.id, from, to);
  }

  @Get('employee/:id')
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  getByEmployee(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getByEmployee(id, from, to);
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  getAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getAll(from, to, status);
  }

  @Patch(':id/regularize')
  @Roles('ADMIN', 'SUPER_ADMIN')
  regularize(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RegularizeDto,
  ) {
    return this.service.regularize(id, user.id, dto);
  }
}
