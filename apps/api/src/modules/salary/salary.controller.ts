import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SalaryService } from './salary.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Salary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('salary')
export class SalaryController {
  constructor(private service: SalaryService) {}

  @Post('slips')
  @Roles('ADMIN', 'SUPER_ADMIN')
  upload(
    @CurrentUser() user: { id: string },
    @Body() body: Parameters<SalaryService['upload']>[1],
  ) {
    return this.service.upload(user.id, body);
  }

  @Get('slips/my')
  findMy(@CurrentUser() user: { id: string }) {
    return this.service.findMy(user.id);
  }

  @Get('slips')
  @Roles('ADMIN', 'SUPER_ADMIN')
  findAll(
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.service.findAll(month, year);
  }
}
