import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CompanyCalendarService } from '../company-calendar/company-calendar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

type ProposalType =
  | 'WORK_UPDATE'
  | 'MEETING_NOTE'
  | 'CLIENT_COMMUNICATION'
  | 'FOLLOW_UP_TASK'
  | 'CALENDAR_EVENT'
  | 'COMPANY_STAGE_UPDATE';

type CreateProposalInput = {
  proposalType: ProposalType;
  submittedBy: string;
  rawInput: string;
  proposedData: Record<string, any>;
  targetEntity?: string | null;
  targetEntityId?: string | null;
  confidence?: number | null;
  aiReason?: string | null;
};

@Injectable()
export class AIProposalsService {
  constructor(
    private prisma: PrismaService,
    private companyCalendar: CompanyCalendarService,
    private notifications: NotificationsService,
    private notificationsGateway: NotificationsGateway,
  ) {}

  create(input: CreateProposalInput) {
    return this.prisma.aIChangeProposal.create({
      data: {
        proposalType: input.proposalType,
        submittedBy: input.submittedBy,
        rawInput: input.rawInput,
        targetEntity: input.targetEntity ?? null,
        targetEntityId: input.targetEntityId ?? null,
        proposedData: input.proposedData as any,
        confidence: input.confidence ?? null,
        aiReason: input.aiReason ?? null,
      },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });
  }

  async findAll(query: { status?: string; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const where: any = {};
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.aIChangeProposal.findMany({
        where,
        include: {
          submitter: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          reviewer: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.aIChangeProposal.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async approve(id: string, reviewer: { id: string; role: string }, corrections?: Record<string, any>) {
    if (reviewer.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can approve AI database changes');
    }

    const proposal = await this.prisma.aIChangeProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('AI proposal not found');
    if (proposal.status !== 'PENDING') throw new BadRequestException('Only pending proposals can be approved');

    const data = { ...((proposal.proposedData as Record<string, any>) ?? {}), ...(corrections ?? {}) };
    const applied = await this.applyProposal(proposal.proposalType as ProposalType, data, proposal.rawInput, proposal.submittedBy, reviewer.id);

    const updated = await this.prisma.aIChangeProposal.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
        appliedEntity: applied.entity,
        appliedEntityId: applied.id,
        proposedData: data as any,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewer.id,
        action: 'AI_PROPOSAL_APPROVED',
        resourceType: 'AIChangeProposal',
        resourceId: id,
        newValue: { applied, proposalType: proposal.proposalType, proposedData: data } as any,
      },
    });

    return { proposal: updated, applied };
  }

  async reject(id: string, reviewer: { id: string; role: string }, reason?: string) {
    if (reviewer.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can reject AI database changes');
    }

    const proposal = await this.prisma.aIChangeProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('AI proposal not found');
    if (proposal.status !== 'PENDING') throw new BadRequestException('Only pending proposals can be rejected');

    const updated = await this.prisma.aIChangeProposal.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: reviewer.id,
        reviewedAt: new Date(),
        rejectionReason: reason ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewer.id,
        action: 'AI_PROPOSAL_REJECTED',
        resourceType: 'AIChangeProposal',
        resourceId: id,
        newValue: { reason: reason ?? null, proposalType: proposal.proposalType } as any,
      },
    });

    return updated;
  }

  private async applyProposal(
    proposalType: ProposalType,
    data: Record<string, any>,
    rawInput: string,
    submittedBy: string,
    approvedBy: string,
  ): Promise<{ entity: string; id: string }> {
    switch (proposalType) {
      case 'WORK_UPDATE':
        return this.applyWorkUpdate(data, rawInput, submittedBy, approvedBy);
      case 'MEETING_NOTE':
        return this.applyMeetingNote(data, rawInput, submittedBy, approvedBy);
      case 'CLIENT_COMMUNICATION':
        return this.applyClientCommunication(data, rawInput, submittedBy);
      case 'FOLLOW_UP_TASK':
        return this.applyFollowUpTask(data, rawInput, submittedBy);
      case 'CALENDAR_EVENT':
        return this.applyCalendarEvent(data, approvedBy);
      case 'COMPANY_STAGE_UPDATE':
        return this.applyCompanyStageUpdate(data, rawInput, approvedBy);
      default:
        throw new BadRequestException(`Unsupported proposal type: ${proposalType}`);
    }
  }

  private async applyWorkUpdate(data: Record<string, any>, rawInput: string, submittedBy: string, approvedBy: string) {
    const updateDate = data.updateDate ? new Date(data.updateDate) : new Date();
    const update = await this.prisma.workUpdate.create({
      data: {
        employeeId: data.employeeId ?? submittedBy,
        companyId: data.companyId ?? null,
        rawText: rawInput,
        updateDate,
        extractedData: data.extractedData ?? data,
        companyName: data.companyName ?? null,
        taskCompleted: data.taskCompleted ?? null,
        pendingTask: data.pendingTask ?? null,
        progress: data.progress ?? null,
        contribution: data.contribution ?? null,
        workStatus: data.workStatus ?? null,
        nextAction: data.nextAction ?? null,
        status: 'APPROVED',
        needsAdminReview: false,
        reviewedBy: approvedBy,
        reviewedAt: new Date(),
      },
    });

    if (data.companyId) {
      await this.prisma.companyTimelineEntry.create({
        data: {
          companyId: data.companyId,
          entryType: 'EMPLOYEE_UPDATE',
          title: `Approved AI update: ${(data.taskCompleted ?? rawInput).substring(0, 60)}`,
          description: data.pendingTask ?? data.nextAction ?? rawInput.substring(0, 200),
          employeeId: data.employeeId ?? submittedBy,
          referenceId: update.id,
          referenceType: 'WorkUpdate',
          entryDate: updateDate,
        },
      });
      await this.prisma.clientCompany.update({
        where: { id: data.companyId },
        data: { lastCommunicationDate: updateDate },
      });
    }

    return { entity: 'WorkUpdate', id: update.id };
  }

  private async applyMeetingNote(data: Record<string, any>, rawInput: string, submittedBy: string, approvedBy: string) {
    const meetingDate = data.meetingDate ? new Date(data.meetingDate) : new Date();
    const note = await this.prisma.meetingNote.create({
      data: {
        enteredBy: data.enteredBy ?? submittedBy,
        companyId: data.companyId ?? null,
        rawText: rawInput,
        meetingDate,
        extractedData: data.extractedData ?? data,
        companyName: data.companyName ?? null,
        employeeName: data.employeeName ?? null,
        workDiscussed: data.workDiscussed ?? null,
        assignedTo: data.assignedTo ?? null,
        deadline: data.deadline ? new Date(data.deadline) : null,
        currentStatus: data.currentStatus ?? null,
        pendingGap: data.pendingGap ?? null,
        followUpAction: data.followUpAction ?? null,
        priorityLevel: data.priorityLevel ?? null,
        ownerNote: data.ownerNote ?? null,
        needsAdminReview: false,
        adminReviewedBy: approvedBy,
        adminReviewedAt: new Date(),
      },
    });

    if (data.companyId) {
      await this.prisma.companyTimelineEntry.create({
        data: {
          companyId: data.companyId,
          entryType: 'MEETING_NOTE',
          title: `Approved AI meeting note: ${(data.workDiscussed ?? rawInput).substring(0, 60)}`,
          description: data.followUpAction ?? data.pendingGap ?? rawInput.substring(0, 200),
          employeeId: data.enteredBy ?? submittedBy,
          referenceId: note.id,
          referenceType: 'MeetingNote',
          entryDate: meetingDate,
        },
      });
      await this.prisma.clientCompany.update({
        where: { id: data.companyId },
        data: { lastCommunicationDate: meetingDate },
      });
    }

    return { entity: 'MeetingNote', id: note.id };
  }

  private async applyClientCommunication(data: Record<string, any>, rawInput: string, submittedBy: string) {
    if (!data.companyId) throw new BadRequestException('companyId is required for client communication proposals');
    const commDate = data.commDate ? new Date(data.commDate) : new Date();
    const communication = await this.prisma.clientCommunication.create({
      data: {
        companyId: data.companyId,
        type: data.type ?? 'EMAIL',
        commDate,
        summary: data.summary ?? rawInput,
        outcome: data.outcome ?? null,
        nextAction: data.nextAction ?? null,
        createdBy: data.createdBy ?? submittedBy,
      },
    });
    await this.prisma.companyTimelineEntry.create({
      data: {
        companyId: data.companyId,
        entryType: 'CLIENT_CALL',
        title: `Approved AI logged ${String(data.type ?? 'communication').toLowerCase()}`,
        description: rawInput.substring(0, 200),
        employeeId: data.createdBy ?? submittedBy,
        referenceId: communication.id,
        referenceType: 'ClientCommunication',
        entryDate: commDate,
      },
    });
    await this.prisma.clientCompany.update({
      where: { id: data.companyId },
      data: { lastCommunicationDate: commDate },
    });
    return { entity: 'ClientCommunication', id: communication.id };
  }

  private async applyFollowUpTask(data: Record<string, any>, rawInput: string, submittedBy: string) {
    if (!data.companyId) throw new BadRequestException('companyId is required for follow-up proposals');
    const task = await this.prisma.followUpTask.create({
      data: {
        companyId: data.companyId,
        assignedTo: data.assignedTo ?? submittedBy,
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
        reason: data.reason ?? rawInput.substring(0, 500),
      },
    });
    await this.prisma.companyTimelineEntry.create({
      data: {
        companyId: data.companyId,
        entryType: 'PENDING_TASK',
        title: 'Approved AI follow-up task',
        description: task.reason,
        employeeId: submittedBy,
        referenceId: task.id,
        referenceType: 'FollowUpTask',
        entryDate: new Date(),
      },
    });
    if (data.assignedTo) {
      const notification = await this.notifications.send(
        data.assignedTo,
        'GENERAL',
        'New approved AI follow-up',
        task.reason,
        task.id,
        'FollowUpTask',
      );
      this.notificationsGateway.sendToEmployee(data.assignedTo, 'follow-up:assigned', { notification, task });
    }
    return { entity: 'FollowUpTask', id: task.id };
  }

  private async applyCalendarEvent(data: Record<string, any>, approvedBy: string) {
    const event = await this.companyCalendar.create(
      {
        title: data.title,
        description: data.description ?? data.reason ?? undefined,
        eventType: data.eventType ?? 'INTERNAL_MEETING',
        startDate: data.startDate ?? data.date ?? new Date().toISOString(),
        endDate: data.endDate,
        allDay: data.allDay ?? true,
        companyId: data.companyId,
        assignedTo: data.assignedTo,
      },
      approvedBy,
    );
    return { entity: 'CalendarEvent', id: event.id };
  }

  private async applyCompanyStageUpdate(data: Record<string, any>, rawInput: string, approvedBy: string) {
    if (!data.companyId) throw new BadRequestException('companyId is required for company update proposals');
    const stage = String(data.currentStage ?? data.stage ?? data.reason ?? '').trim();
    if (!stage) throw new BadRequestException('currentStage is required for company update proposals');
    await this.prisma.clientCompany.update({
      where: { id: data.companyId },
      data: { currentStage: stage.substring(0, 200) },
    });
    const entry = await this.prisma.companyTimelineEntry.create({
      data: {
        companyId: data.companyId,
        entryType: 'STATUS_CHANGE',
        title: 'Approved AI company stage update',
        description: rawInput.substring(0, 200),
        employeeId: approvedBy,
        entryDate: new Date(),
      },
    });
    return { entity: 'CompanyTimelineEntry', id: entry.id };
  }
}
