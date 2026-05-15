import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

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

  async findAll(status?: string) {
    const where = status ? { status: status as never } : {};
    return this.prisma.expense.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async approveL1(id: string, approverId: string, action: 'approve' | 'reject', reason?: string) {
    const expense = await this.findOne(id);
    if (expense.status !== 'SUBMITTED') {
      throw new ForbiddenException('Expense is not in submitted state');
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

  async approveFinance(id: string, approverId: string, action: 'approve' | 'reject', reason?: string) {
    const expense = await this.findOne(id);
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
    const expense = await this.findOne(id);
    if (expense.status !== 'APPROVED') {
      throw new ForbiddenException('Expense must be approved before marking paid');
    }

    return this.prisma.expense.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), paymentRef },
    });
  }
}
