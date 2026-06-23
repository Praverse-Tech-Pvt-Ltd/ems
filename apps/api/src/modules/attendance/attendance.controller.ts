import { Controller, Post, Delete, Get, Patch, Body, Param, Query, UseGuards, Ip, Headers, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AttendanceBalanceService } from './attendance-balance.service';

import { PunchInDto } from './dto/punch-in.dto';
import { RegularizeDto } from './dto/regularize.dto';
import { OdPunchInDto, OdPunchOutDto } from './dto/od-punch.dto';
import { AdminUpsertAttendanceDto } from './dto/admin-upsert.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private service: AttendanceService,
    private balances: AttendanceBalanceService,
  ) {}

  @Post('punch-in')
  punchIn(
    @CurrentUser() user: { id: string },
    @Body() dto: PunchInDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.service.punchIn(user.id, dto, ip, userAgent);
  }

  @Post('punch-out')
  punchOut(
    @CurrentUser() user: { id: string },
    @Body() dto: PunchInDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.service.punchOut(user.id, dto, ip, userAgent);
  }

  @Post('od/punch-in')
  odPunchIn(
    @CurrentUser() user: { id: string },
    @Body() dto: OdPunchInDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.service.odPunchIn(user.id, dto, ip, userAgent);
  }

  @Post('od/punch-out')
  odPunchOut(
    @CurrentUser() user: { id: string },
    @Body() dto: OdPunchOutDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.service.odPunchOut(user.id, dto, ip, userAgent);
  }

  @Get('od/open')
  getOpenOd(@CurrentUser() user: { id: string }) {
    return this.service.getOpenOd(user.id);
  }



  @Get('today')
  getToday(@CurrentUser() user: { id: string }) {
    return this.service.getToday(user.id);
  }

  @Get('my/stats')
  getMyStats(@CurrentUser() user: { id: string }) {
    return this.service.getMyStats(user.id);
  }

  @Get('my/policy-usage')
  getPolicyUsage(@CurrentUser() user: { id: string }) {
    return this.service.getPolicyUsage(user.id);
  }

  @Get('my')
  getMy(
    @CurrentUser() user: { id: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getByEmployee(user.id, from, to, limit ? Number(limit) : undefined);
  }

  @Get('employee/:id')
  getByEmployee(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const isSelf = user.id === id;
    const isManager = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);
    if (!isSelf && !isManager) {
      throw new ForbiddenException('You can only view your own attendance records');
    }
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

  @Get('admin/monthly-balances')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getMonthlyBalances(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.balances.list(Number(month), Number(year), employeeId);
  }

  @Post('admin/monthly-balances/recalculate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  recalculateMonthlyBalances(
    @CurrentUser() user: { id: string },
    @Body() dto: { month: number; year: number; employeeId?: string },
  ) {
    return this.balances.recalculateMonth(user.id, dto);
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

  @Patch(':id/edit-time')
  @Roles('ADMIN', 'SUPER_ADMIN')
  editTime(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: { punchInTime?: string; punchOutTime?: string; reason: string },
  ) {
    return this.service.editAttendanceTime(id, user.id, dto);
  }

  @Get(':id/edit-history')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getEditHistory(@Param('id') id: string) {
    return this.service.getEditHistory(id);
  }

  @Post('admin-upsert')
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminUpsert(
    @CurrentUser() user: { id: string },
    @Body() dto: AdminUpsertAttendanceDto,
  ) {
    return this.service.adminUpsert(user.id, dto);
  }
}
