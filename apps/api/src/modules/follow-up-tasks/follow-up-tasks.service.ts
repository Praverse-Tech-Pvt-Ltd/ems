import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { differenceInDays } from 'date-fns';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FollowUpTasksService {
  private thresholdMild: number;
  private thresholdModerate: number;
  private thresholdCritical: number;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private config: ConfigService,
  ) {
    this.thresholdMild     = parseInt(this.config.get('FOLLOWUP_THRESHOLD_MILD',     '7'));
    this.thresholdModerate = parseInt(this.config.get('FOLLOWUP_THRESHOLD_MODERATE', '15'));
    this.thresholdCritical = parseInt(this.config.get('FOLLOWUP_THRESHOLD_CRITICAL', '30'));
  }

  async findAll(query: { status?: string; assignedToMe?: boolean; companyId?: string; employeeId?: string }) {
    const where: any = {};
    if (query.status)      where.status    = query.status;
    if (query.companyId)   where.companyId = query.companyId;
    if (query.assignedToMe && query.employeeId) where.assignedTo = query.employeeId;

    return this.prisma.followUpTask.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, criticality: true, businessStatus: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });
  }

  async complete(id: string, completionNote: string, completedBy: string) {
    const task = await this.prisma.followUpTask.update({
      where: { id },
      data: { status: 'DONE', completionNote, completedAt: new Date() },
      include: { company: true },
    });

    // Auto-create work update from completion note
    if (completionNote && task.company) {
      await this.prisma.workUpdate.create({
        data: {
          employeeId: completedBy,
          companyId: task.companyId,
          rawText: completionNote,
          updateDate: new Date(),
          workStatus: 'Completed',
          taskCompleted: completionNote,
          companyName: task.company.name,
          status: 'APPROVED',
        },
      });

      await this.prisma.companyTimelineEntry.create({
        data: {
          companyId: task.companyId,
          entryType: 'COMPLETED_TASK',
          title: `Follow-up completed`,
          description: completionNote,
          employeeId: completedBy,
          referenceId: id,
          referenceType: 'FollowUpTask',
          entryDate: new Date(),
        },
      });
    }

    return task;
  }

  async snooze(id: string, snoozedUntil: string) {
    return this.prisma.followUpTask.update({
      where: { id },
      data: { status: 'SNOOZED', snoozedUntil: new Date(snoozedUntil) },
    });
  }

  async create(dto: { companyId: string; assignedTo: string; dueDate: string; reason: string }) {
    return this.prisma.followUpTask.create({ data: { ...dto, dueDate: new Date(dto.dueDate) } });
  }

  @Cron('0 8 * * *')
  async runFollowUpCheck() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const companies = await this.prisma.clientCompany.findMany({
      where: { isArchived: false, businessStatus: { not: 'LOST' } },
      select: {
        id: true, name: true, lastCommunicationDate: true,
        responsibleEmployeeId: true, criticality: true,
      },
    });

    for (const c of companies) {
      if (!c.responsibleEmployeeId) continue;
      const daysSinceComm = c.lastCommunicationDate
        ? differenceInDays(now, c.lastCommunicationDate)
        : 999;

      const threshold =
        c.criticality === 'HIGH' ? this.thresholdMild :
        c.criticality === 'MEDIUM' ? this.thresholdModerate :
        this.thresholdCritical;

      if (daysSinceComm < threshold) continue;

      // Don't duplicate if OPEN task exists for this company in last 7 days
      const existing = await this.prisma.followUpTask.findFirst({
        where: {
          companyId: c.id,
          status: 'OPEN',
          createdAt: { gte: sevenDaysAgo },
        },
      });
      if (existing) continue;

      const priority =
        daysSinceComm >= this.thresholdCritical ? 'CRITICAL' :
        daysSinceComm >= this.thresholdModerate ? 'MODERATE' : 'MILD';

      const task = await this.prisma.followUpTask.create({
        data: {
          companyId: c.id,
          assignedTo: c.responsibleEmployeeId,
          dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
          reason: `No communication for ${daysSinceComm} days [${priority}]`,
        },
      });

      await this.notifications.send(
        c.responsibleEmployeeId,
        'GENERAL',
        `Follow-up required: ${c.name}`,
        `No communication for ${daysSinceComm} days. Follow-up due in 2 days.`,
        task.id,
        'follow_up_task',
      );
    }
  }
}
