import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ExpenseStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

const VALID_EXPENSE_STATUSES = new Set<string>(Object.values(ExpenseStatus));

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] as const;

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(employeeId: string, dto: CreateExpenseDto, billS3Key?: string) {
    return this.prisma.expense.create({
      data: {
        employeeId,
        category: dto.category,
        amount: dto.amount,
        expenseDate: new Date(dto.expenseDate),
        description: dto.description,
        paymentMode: dto.paymentMode,
        billS3Key,
        status: 'SUBMITTED',
      },
    });
  }

  async findMy(employeeId: string) {
    return this.prisma.expense.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(status?: string, employeeId?: string) {
    if (status && !VALID_EXPENSE_STATUSES.has(status)) {
      throw new BadRequestException(`Invalid status value: ${status}`);
    }
    const where: any = {};
    if (status) {
      where.status = status as ExpenseStatus;
    }
    if (employeeId) {
      where.employeeId = employeeId;
    }
    return this.prisma.expense.findMany({
      where,
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetch a single expense.
   * - Admin / manager roles may read any expense.
   * - Regular employees may only read their own expense.
   */
  async findOne(
    id: string,
    requestor: { id: string; role: string },
  ) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    const isPrivileged = (ADMIN_ROLES as readonly string[]).includes(requestor.role);
    if (!isPrivileged && expense.employeeId !== requestor.id) {
      throw new ForbiddenException('Access denied');
    }

    return expense;
  }

  /** Internal helper used by approval methods — skips ownership check. */
  private async _findOneUnchecked(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async approveL1(
    id: string,
    approverId: string,
    action: 'approve' | 'reject',
    reason?: string,
  ) {
    const expense = await this._findOneUnchecked(id);
    if (expense.status !== 'SUBMITTED') {
      throw new ForbiddenException('Expense is not in submitted state');
    }
    if (expense.employeeId === approverId) {
      throw new ForbiddenException('You cannot approve your own expense');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'FINANCE_REVIEW' : 'REJECTED',
        l1ApproverId: approverId,
        l1ApprovedAt: new Date(),
        rejectionReason: action === 'reject' ? reason : null,
      },
    });
  }

  async approveFinance(
    id: string,
    approverId: string,
    action: 'approve' | 'reject',
    reason?: string,
  ) {
    const expense = await this._findOneUnchecked(id);
    if (expense.status !== 'FINANCE_REVIEW') {
      throw new ForbiddenException('Expense is not in finance review state');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        financeApproverId: approverId,
        financeApprovedAt: new Date(),
        rejectionReason: action === 'reject' ? reason : null,
      },
    });
  }

  async markPaid(id: string, paymentRef: string) {
    const expense = await this._findOneUnchecked(id);
    if (expense.status !== 'APPROVED') {
      throw new ForbiddenException('Expense must be approved before marking paid');
    }

    return this.prisma.expense.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), paymentRef },
    });
  }
}
