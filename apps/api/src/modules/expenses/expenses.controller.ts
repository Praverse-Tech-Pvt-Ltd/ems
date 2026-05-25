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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ApproveExpenseDto, MarkPaidDto } from './dto/approve-expense.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private service: ExpensesService) {}

  @Post()
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateExpenseDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Get('my')
  findMy(@CurrentUser() user: { id: string }) {
    return this.service.findMy(user.id);
  }

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'MANAGER')
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  /** Ownership-checked: employees can only see their own expense. */
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/approve-l1')
  @Roles('MANAGER', 'ADMIN', 'SUPER_ADMIN')
  approveL1(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ApproveExpenseDto,
  ) {
    return this.service.approveL1(id, user.id, dto.action, dto.reason);
  }

  @Patch(':id/approve-finance')
  @Roles('ADMIN', 'SUPER_ADMIN')
  approveFinance(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ApproveExpenseDto,
  ) {
    return this.service.approveFinance(id, user.id, dto.action, dto.reason);
  }

  @Patch(':id/mark-paid')
  @Roles('ADMIN', 'SUPER_ADMIN')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.service.markPaid(id, dto.paymentRef);
  }
}
