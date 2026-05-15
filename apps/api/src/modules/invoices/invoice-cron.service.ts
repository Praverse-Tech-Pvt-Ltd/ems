import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InvoiceCronService {
  private readonly logger = new Logger(InvoiceCronService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 1 * * *', { name: 'overdue-invoices', timeZone: 'Asia/Kolkata' })
  async markOverdueInvoices() {
    const result = await this.prisma.invoice.updateMany({
      where: {
        dueDate: { lt: new Date() },
        status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] },
      },
      data: { status: 'OVERDUE' },
    });
    this.logger.log(`Marked ${result.count} invoices as overdue`);
  }
}
