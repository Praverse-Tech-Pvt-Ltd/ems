import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const VALID_INVOICE_STATUSES = new Set<string>(Object.values(InvoiceStatus));

export interface CreateInvoiceData {
  invoiceNumber: string;
  type: 'VENDOR' | 'CLIENT';
  partyName: string;
  amount: number;
  gstPercent?: number;
  dueDate: string;
  description?: string;
  fileS3Key?: string;
}

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async create(submittedBy: string, data: CreateInvoiceData) {
    return this.prisma.invoice.create({
      data: {
        ...data,
        dueDate: new Date(data.dueDate),
        submittedBy,
        status: 'PENDING',
      },
    });
  }

  async findAll(status?: string) {
    if (status && !VALID_INVOICE_STATUSES.has(status)) {
      throw new BadRequestException(`Invalid status value: ${status}`);
    }
    const where = status ? { status: status as InvoiceStatus } : {};
    return this.prisma.invoice.findMany({
      where,
      include: {
        submitter: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async updateStatus(
    id: string,
    approvedBy: string,
    status: 'APPROVED' | 'REJECTED' | 'PAID',
    paymentRef?: string,
  ) {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status,
        approvedBy,
        ...(status === 'PAID' ? { paidAt: new Date(), paymentRef } : {}),
      },
    });
  }
}
