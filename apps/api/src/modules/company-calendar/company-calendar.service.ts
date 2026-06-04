import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CompanyCalendarService {
  constructor(private prisma: PrismaService) {}

  async create(dto: {
    title: string;
    description?: string;
    eventType: string;
    startDate: string;
    endDate?: string;
    allDay?: boolean;
    companyId?: string;
    assignedTo?: string;
    reminderDays?: number;
    isRecurring?: boolean;
    recurringRule?: string;
  }, createdBy: string) {
    const event = await this.prisma.calendarEvent.create({
      data: {
        title: dto.title,
        description: dto.description,
        eventType: dto.eventType as any,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        allDay: dto.allDay ?? false,
        companyId: dto.companyId,
        assignedTo: dto.assignedTo,
        createdBy,
        reminderDays: dto.reminderDays,
        isRecurring: dto.isRecurring ?? false,
        recurringRule: dto.recurringRule,
      },
      include: {
        company: { select: { id: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (dto.companyId) {
      await this.prisma.companyTimelineEntry.create({
        data: {
          companyId: dto.companyId,
          entryType: 'AUDIT_PREP',
          title: `Calendar: ${dto.title}`,
          description: dto.description ?? '',
          employeeId: createdBy,
          referenceId: event.id,
          referenceType: 'CalendarEvent',
          entryDate: new Date(dto.startDate),
        },
      });
    }

    return event;
  }

  async findAll(query: {
    from?: string;
    to?: string;
    companyId?: string;
    assignedTo?: string;
    eventType?: string;
  }) {
    const where: any = {};
    if (query.companyId) where.companyId = query.companyId;
    if (query.assignedTo) where.assignedTo = query.assignedTo;
    if (query.eventType) where.eventType = query.eventType;
    if (query.from || query.to) {
      where.startDate = {};
      if (query.from) where.startDate.gte = new Date(query.from);
      if (query.to) where.startDate.lte = new Date(query.to);
    }

    return this.prisma.calendarEvent.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async findUpcoming(days = 30) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return this.findAll({ from: now.toISOString(), to: future.toISOString() });
  }

  async update(id: string, dto: Partial<{
    title: string; description: string; startDate: string; endDate: string;
    assignedTo: string; reminderDays: number;
  }>) {
    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.calendarEvent.delete({ where: { id } });
  }

  async getAuditCountdowns() {
    const events = await this.findAll({ eventType: 'AUDIT' });
    const now = new Date();
    return events.map(e => ({
      ...e,
      daysUntil: Math.ceil((e.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    })).filter(e => e.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil);
  }
}
