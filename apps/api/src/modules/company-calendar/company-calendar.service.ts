import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class CompanyCalendarService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  private async notifyAssignee(event: any, createdBy: string) {
    if (!event.assignedTo || event.assignedTo === createdBy) return;

    const companyName = event.company?.name ? ` for ${event.company.name}` : '';
    const title = `New visit assigned: ${event.title}`;
    const body = `You've been assigned to "${event.title}"${companyName} on ${new Date(event.startDate).toLocaleDateString()}.`;

    const notification = await this.notifications.send(
      event.assignedTo,
      'CALENDAR_EVENT_ASSIGNED',
      title,
      body,
      event.id,
      'CalendarEvent',
    );

    this.notificationsGateway.sendToEmployee(event.assignedTo, 'calendar:assigned', {
      notification,
      event,
    });
  }

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

    await this.notifyAssignee(event, createdBy);

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
  }>, updatedBy?: string) {
    const before = await this.prisma.calendarEvent.findUnique({ where: { id } });

    const event = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        company: { select: { id: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (updatedBy && dto.assignedTo && dto.assignedTo !== before?.assignedTo) {
      await this.notifyAssignee(event, updatedBy);
    }

    return event;
  }

  async remove(id: string, requestedBy: string) {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Calendar event not found');

    if (event.createdBy !== requestedBy && event.assignedTo !== requestedBy) {
      const requester = await this.prisma.employee.findUnique({ where: { id: requestedBy } });
      if (!requester || !['ADMIN', 'SUPER_ADMIN'].includes(requester.role)) {
        throw new ForbiddenException('You can only delete events you created or are assigned to');
      }
    }

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

  private readonly REGULATORY_TYPES = [
    'WHO_AUDIT', 'GMP_RENEWAL', 'CDSCO_SUBMISSION',
    'FDA_INSPECTION', 'DRUG_LICENSE_RENEWAL',
  ];

  async findRegulatory(companyId?: string) {
    return this.prisma.calendarEvent.findMany({
      where: {
        eventType: { in: this.REGULATORY_TYPES as any[] },
        ...(companyId && { companyId }),
      },
      include: {
        company: { select: { id: true, name: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async seedRegulatoryEvents(createdBy: string) {
    const companies = await this.prisma.clientCompany.findMany({
      where: { isArchived: false, nextAuditDate: { not: null } },
      select: { id: true, name: true, nextAuditDate: true },
    });

    let count = 0;
    for (const c of companies) {
      if (!c.nextAuditDate) continue;
      const existing = await this.prisma.calendarEvent.findFirst({
        where: { companyId: c.id, eventType: 'WHO_AUDIT', startDate: c.nextAuditDate },
      });
      if (existing) continue;

      await this.prisma.calendarEvent.create({
        data: {
          title: `${c.name} — Scheduled Audit`,
          eventType: 'WHO_AUDIT',
          startDate: c.nextAuditDate,
          allDay: true,
          companyId: c.id,
          createdBy,
          reminderDays: 30,
        },
      });
      count++;
    }
    return { seeded: count };
  }
}
