import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ClientCommunicationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, page = 1, limit = 30) {
    const [items, total] = await Promise.all([
      this.prisma.clientCommunication.findMany({
        where: { companyId },
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { commDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.clientCommunication.count({ where: { companyId } }),
    ]);
    return { items, total, page, limit };
  }

  async create(companyId: string, dto: {
    type: string; commDate: string; summary: string;
    outcome?: string; nextAction?: string;
  }, createdBy: string) {
    const company = await this.prisma.clientCompany.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const comm = await this.prisma.clientCommunication.create({
      data: {
        companyId,
        type: dto.type as any,
        commDate: new Date(dto.commDate),
        summary: dto.summary,
        outcome: dto.outcome,
        nextAction: dto.nextAction,
        createdBy,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Update lastCommunicationDate if this is more recent
    const newDate = new Date(dto.commDate);
    if (!company.lastCommunicationDate || newDate > company.lastCommunicationDate) {
      await this.prisma.clientCompany.update({
        where: { id: companyId },
        data: { lastCommunicationDate: newDate },
      });
    }

    // Auto-create timeline entry
    const typeMap: Record<string, string> = {
      EMAIL: '📧', PHONE_CALL: '📞', WHATSAPP: '💬',
      IN_PERSON: '🤝', VIDEO_CALL: '📹', LETTER: '✉️',
    };
    const icon = typeMap[dto.type] ?? '💬';
    await this.prisma.companyTimelineEntry.create({
      data: {
        companyId,
        entryType: 'CLIENT_CALL',
        title: `${icon} ${dto.type.replace('_', ' ')}: ${dto.summary.substring(0, 60)}`,
        description: dto.outcome ?? dto.nextAction ?? '',
        employeeId: createdBy,
        referenceId: comm.id,
        referenceType: 'ClientCommunication',
        entryDate: new Date(dto.commDate),
      },
    });

    // Resolve any "no communication" alerts for this company
    await this.prisma.companyAlert.updateMany({
      where: {
        companyId,
        isResolved: false,
        alertType: { in: ['NO_COMM_7', 'NO_COMM_15', 'NO_COMM_30'] },
      },
      data: { isResolved: true, resolvedAt: new Date(), resolvedBy: createdBy },
    });

    return comm;
  }

  async update(id: string, dto: any) {
    return this.prisma.clientCommunication.update({
      where: { id },
      data: {
        ...(dto.summary && { summary: dto.summary }),
        ...(dto.outcome !== undefined && { outcome: dto.outcome }),
        ...(dto.nextAction !== undefined && { nextAction: dto.nextAction }),
        ...(dto.commDate && { commDate: new Date(dto.commDate) }),
      },
    });
  }

  async remove(id: string) {
    return this.prisma.clientCommunication.delete({ where: { id } });
  }
}
