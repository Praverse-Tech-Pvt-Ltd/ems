import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('dashboard')
  dashboard() {
    return this.service.dashboardStats();
  }

  @Get('attendance')
  attendance(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.attendanceSummary(from, to, employeeId);
  }

  @Get('expenses')
  expenses(@Query('from') from: string, @Query('to') to: string) {
    return this.service.expenseSummary(from, to);
  }

  @Get('payroll')
  @Roles('ADMIN', 'SUPER_ADMIN')
  payroll(@Query('month') month: number, @Query('year') year: number) {
    return this.service.payrollSummary(month, year);
  }
}
