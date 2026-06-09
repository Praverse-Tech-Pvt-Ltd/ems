import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';
import { AIProposalsService } from '../ai-proposals/ai-proposals.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CompanyCalendarService } from '../company-calendar/company-calendar.service';

const OWNER_EMAILS = [
  'ashwani@nexgenpharmasolutions.com',
  'pratham.s@nexgenpharmasolutions.com',
];

@Injectable()
export class AIChatService {
  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
    private aiProposals: AIProposalsService,
    private notifications: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private companyCalendar: CompanyCalendarService,
  ) {}

  private assertOwner(email: string) {
    if (!OWNER_EMAILS.includes(email.toLowerCase())) {
      throw new ForbiddenException('AI Chat is restricted to owners only');
    }
  }

  private async buildContext(): Promise<string> {
    const now = new Date();
    const lines: string[] = ['=== NEXGEN EMS LIVE DATA ===', `Date: ${now.toISOString().split('T')[0]}`, ''];

    try {
      const employees = await this.prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { firstName: true, lastName: true, designation: true, role: true },
        take: 50,
      });
      lines.push('--- ACTIVE EMPLOYEES ---');
      for (const e of employees) {
        lines.push(`- ${e.firstName} ${e.lastName} | ${e.designation ?? 'N/A'} | ${e.role}`);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayAttendance = await this.prisma.attendanceRecord.count({
        where: { date: { gte: today } },
      });
      lines.push('', "--- TODAY'S ATTENDANCE ---");
      lines.push(`- ${todayAttendance} employees have marked attendance today`);

      const companies = await this.prisma.clientCompany.findMany({
        where: { isArchived: false },
        include: {
          responsibleEmployee: { select: { firstName: true, lastName: true } },
          alerts: { where: { isResolved: false }, select: { severity: true, alertType: true, message: true } },
          workUpdates: {
            orderBy: { updateDate: 'desc' },
            take: 3,
            select: {
              updateDate: true,
              rawText: true,
              taskCompleted: true,
              pendingTask: true,
              workStatus: true,
              nextAction: true,
              employee: { select: { firstName: true, lastName: true } },
            },
          },
          meetingNotes: {
            orderBy: { meetingDate: 'desc' },
            take: 3,
            select: {
              meetingDate: true,
              workDiscussed: true,
              assignedTo: true,
              pendingGap: true,
              followUpAction: true,
              priorityLevel: true,
              needsAdminReview: true,
            },
          },
          followUpTasks: {
            where: { status: { in: ['OPEN', 'SNOOZED'] as any } },
            orderBy: { dueDate: 'asc' },
            take: 3,
            select: {
              reason: true,
              dueDate: true,
              status: true,
              assignee: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ riskScore: 'desc' }, { name: 'asc' }],
        take: 30,
      });

      lines.push('', '--- CLIENT PORTFOLIO ---');
      lines.push(`Total active client companies: ${companies.length}`);
      for (const c of companies) {
        const owner = c.responsibleEmployee
          ? `${c.responsibleEmployee.firstName} ${c.responsibleEmployee.lastName}`
          : 'Unassigned';
        lines.push(
          `- ${c.name} | status=${c.businessStatus} | criticality=${c.criticality} | risk=${c.riskScore} | owner=${owner}`,
        );
        if (c.currentStage) lines.push(`  stage: ${c.currentStage}`);
        if (c.notes) lines.push(`  notes: ${c.notes}`);
        if (c.lastCommunicationDate) {
          lines.push(`  last communication: ${c.lastCommunicationDate.toISOString().split('T')[0]}`);
        }
        if (c.lastVisitDate) lines.push(`  last visit: ${c.lastVisitDate.toISOString().split('T')[0]}`);
        if (c.nextAuditDate) lines.push(`  next audit: ${c.nextAuditDate.toISOString().split('T')[0]}`);

        for (const alert of c.alerts) {
          lines.push(`  alert: ${alert.severity} ${alert.alertType} - ${alert.message}`);
        }
        for (const update of c.workUpdates) {
          const employee = update.employee
            ? `${update.employee.firstName} ${update.employee.lastName}`
            : 'Unknown';
          lines.push(
            `  update ${update.updateDate.toISOString().split('T')[0]} by ${employee}: ${
              update.taskCompleted ?? update.workStatus ?? update.rawText
            }`,
          );
          if (update.pendingTask) lines.push(`    pending: ${update.pendingTask}`);
          if (update.nextAction) lines.push(`    next action: ${update.nextAction}`);
        }
        for (const note of c.meetingNotes) {
          lines.push(
            `  meeting ${note.meetingDate.toISOString().split('T')[0]}: ${
              note.workDiscussed ?? 'discussion recorded'
            }`,
          );
          if (note.pendingGap) lines.push(`    gap: ${note.pendingGap}`);
          if (note.followUpAction) lines.push(`    follow-up: ${note.followUpAction}`);
          if (note.assignedTo) lines.push(`    assigned to: ${note.assignedTo}`);
          if (note.priorityLevel) lines.push(`    priority: ${note.priorityLevel}`);
          if (note.needsAdminReview) lines.push('    needs admin review');
        }
        for (const task of c.followUpTasks) {
          const assignee = task.assignee
            ? `${task.assignee.firstName} ${task.assignee.lastName}`
            : 'Unassigned';
          const due = task.dueDate ? task.dueDate.toISOString().split('T')[0] : 'no due date';
          lines.push(`  follow-up task: ${task.reason} | ${task.status} | ${due} | ${assignee}`);
        }
      }

      const [workReviews, meetingReviews, openAlerts] = await Promise.all([
        this.prisma.workUpdate.count({ where: { needsAdminReview: true } }),
        this.prisma.meetingNote.count({ where: { needsAdminReview: true } }),
        this.prisma.companyAlert.count({ where: { isResolved: false } }),
      ]);
      lines.push('', '--- OPERATIONS QUEUE ---');
      lines.push(`Work updates needing review: ${workReviews}`);
      lines.push(`Meeting notes needing review: ${meetingReviews}`);
      lines.push(`Open company alerts: ${openAlerts}`);
    } catch {
      lines.push('(Live data temporarily unavailable)');
    }

    return lines.join('\n');
  }

  private looksLikeOperationalUpdate(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    if (!normalized || normalized.includes('?')) return false;

    const commandStyle = /^(record|log|add|note|update|save)\b/.test(normalized);
    const updateWords = [
      'pending',
      'completed',
      'done',
      'blocked',
      'delay',
      'delayed',
      'issue',
      'follow up',
      'follow-up',
      'audit',
      'visit',
      'call',
      'meeting',
      'document',
      'dossier',
      'query',
      'commitment',
    ];

    return commandStyle || updateWords.some((word) => normalized.includes(word));
  }

  private looksLikeMeetingMinutes(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    return /\b(mom|minutes|meeting note|discussed|discussion|team meeting|internal meeting|review meeting)\b/.test(
      normalized,
    );
  }

  private getCommunicationType(text: string) {
    const normalized = text.toLowerCase();
    if (normalized.includes('whatsapp')) return 'WHATSAPP';
    if (normalized.includes('email') || normalized.includes('mail')) return 'EMAIL';
    if (normalized.includes('call')) return 'PHONE_CALL';
    return null;
  }

  private parseDueDate(text: string): Date {
    const normalized = text.toLowerCase();
    const now = new Date();
    const due = new Date(now);

    if (normalized.includes('tomorrow')) {
      due.setDate(now.getDate() + 1);
      return due;
    }

    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekday = weekdays.findIndex((day) => normalized.includes(`by ${day}`) || normalized.includes(day));
    if (weekday >= 0) {
      const daysUntil = (weekday - now.getDay() + 7) % 7 || 7;
      due.setDate(now.getDate() + daysUntil);
      return due;
    }

    const iso = normalized.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso?.[1]) return new Date(iso[1]);

    const days = normalized.match(/\b(?:in|after)\s+(\d{1,2})\s+days?\b/);
    if (days) {
      due.setDate(now.getDate() + Number(days[1]));
      return due;
    }

    due.setDate(now.getDate() + 2);
    return due;
  }

  private async resolveCompany(question: string, extractedCompanyName?: string | null) {
    if (extractedCompanyName) {
      const found = await this.prisma.clientCompany.findFirst({
        where: { name: { contains: extractedCompanyName, mode: 'insensitive' as any }, isArchived: false },
      });
      if (found) return found;
    }

    const companies = await this.prisma.clientCompany.findMany({
      where: { isArchived: false },
      select: { id: true, name: true, responsibleEmployeeId: true },
    });
    const normalized = question.toLowerCase();
    return (
      companies.find((company) => normalized.includes(company.name.toLowerCase())) ??
      companies.find((company) =>
        company.name
          .toLowerCase()
          .split(/\s+/)
          .filter((part) => part.length >= 5)
          .some((part) => normalized.includes(part)),
      ) ??
      null
    );
  }

  private async resolveEmployee(question: string, assignedTo?: string | null) {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const normalized = `${question} ${assignedTo ?? ''}`.toLowerCase();
    return (
      employees.find((employee) =>
        [employee.firstName, employee.lastName, `${employee.firstName} ${employee.lastName}`, employee.email]
          .filter(Boolean)
          .some((value) => normalized.includes(value!.toLowerCase())),
      ) ?? null
    );
  }

  /**
   * Keeps ClientCompany summary fields ("currentStage", "lastVisitDate",
   * "riskScore") in step with whatever the AI just extracted from chat —
   * this is the "AI mapping" that ensures the company record always
   * reflects the latest visit/note/communication, not just lastCommunicationDate.
   */
  private async syncCompanyFromActivity(
    companyId: string,
    updateDate: Date,
    extracted: Record<string, any>,
    question: string,
  ) {
    const data: Record<string, any> = { lastCommunicationDate: updateDate };

    const stageSignal =
      extracted.currentStatus ?? extracted.workStatus ?? extracted.pendingGap ?? extracted.followUpAction;
    if (typeof stageSignal === 'string' && stageSignal.trim()) {
      data.currentStage = stageSignal.trim().substring(0, 200);
    }

    if (/\b(visit|visited|site visit|on[- ]?site)\b/i.test(question)) {
      data.lastVisitDate = updateDate;
    }

    const company = await this.prisma.clientCompany.findUnique({
      where: { id: companyId },
      select: { riskScore: true },
    });
    if (company && typeof company.riskScore === 'number') {
      const lowered = question.toLowerCase();
      if (/\b(urgent|escalat|at risk|show cause|non[- ]?compliance|critical)\b/.test(lowered)) {
        data.riskScore = Math.min(100, company.riskScore + 5);
      } else if (/\b(resolved|closed|cleared|completed|on track)\b/.test(lowered)) {
        data.riskScore = Math.max(0, company.riskScore - 5);
      }
    }

    await this.prisma.clientCompany.update({ where: { id: companyId }, data });
  }

  /**
   * Gives the AI chat write access: when the owner asks it to *do* something
   * ("assign Shifa to visit Romano Drugs next Tuesday", "create a follow-up
   * for Dilip on Vemed's batch gap"), this detects the intent via Gemini and
   * actually performs it — creating the calendar event/task/note through the
   * same services the UI uses (so notifications + calendar sync fire too) —
   * rather than just describing what the user should do.
   */
  private async tryExecuteAction(question: string, userId: string): Promise<string | null> {
    const intent = await this.gemini.detectActionRequest(question);
    if (!intent || !intent.action) return null;

    const foundCompany = await this.resolveCompany(question, intent.companyName ?? null);
    const assignedEmployee = await this.resolveEmployee(question, intent.employeeName ?? null);
    const when = intent.date ? new Date(intent.date) : this.parseDueDate(question);

    if (intent.action === 'ASSIGN_VISIT' || intent.action === 'SCHEDULE_EVENT') {
      if (!assignedEmployee) return null;
      const title = (
        intent.title?.trim() || `Visit: ${foundCompany?.name ?? 'Client'} - ${assignedEmployee.firstName}`
      ).substring(0, 200);
      await this.aiProposals.create({
        proposalType: 'CALENDAR_EVENT',
        submittedBy: userId,
        rawInput: question,
        targetEntity: 'CalendarEvent',
        targetEntityId: foundCompany?.id ?? null,
        aiReason: intent.reason ?? null,
        proposedData: {
          title,
          description: intent.reason?.toString().trim().substring(0, 500) || undefined,
          eventType: intent.action === 'ASSIGN_VISIT' ? 'CLIENT_VISIT' : 'INTERNAL_MEETING',
          startDate: when.toISOString(),
          allDay: true,
          companyId: foundCompany?.id,
          assignedTo: assignedEmployee.id,
        },
      });
      return `Queued for Pratham's approval - schedule "${title}" for ${when.toLocaleDateString('en-IN')}, assigned to ${assignedEmployee.firstName} ${assignedEmployee.lastName}. No calendar/database change has been applied yet.`;
    }

    if (intent.action === 'CREATE_FOLLOW_UP') {
      if (!foundCompany) return null;
      const reason = (intent.reason ?? intent.title ?? question).toString().trim().substring(0, 500);
      await this.aiProposals.create({
        proposalType: 'FOLLOW_UP_TASK',
        submittedBy: userId,
        rawInput: question,
        targetEntity: 'FollowUpTask',
        targetEntityId: foundCompany.id,
        aiReason: reason,
        proposedData: {
          companyId: foundCompany.id,
          assignedTo: assignedEmployee?.id ?? userId,
          dueDate: when.toISOString(),
          reason,
        },
      });
      return `Queued for Pratham's approval - create a follow-up on ${foundCompany.name} due ${when.toLocaleDateString('en-IN')}${assignedEmployee ? `, assigned to ${assignedEmployee.firstName} ${assignedEmployee.lastName}` : ''}.`;
    }

    if (intent.action === 'UPDATE_COMPANY_NOTE') {
      if (!foundCompany) return null;
      const stage = (intent.title?.trim() || intent.reason?.trim() || '').toString();
      if (!stage) return null;
      await this.aiProposals.create({
        proposalType: 'COMPANY_STAGE_UPDATE',
        submittedBy: userId,
        rawInput: question,
        targetEntity: 'ClientCompany',
        targetEntityId: foundCompany.id,
        aiReason: stage,
        proposedData: {
          companyId: foundCompany.id,
          currentStage: stage.substring(0, 200),
        },
      });
      return `Queued for Pratham's approval - update ${foundCompany.name}'s current stage to "${stage}".`;
    }

    try {
      switch (intent.action) {
        case 'ASSIGN_VISIT':
        case 'SCHEDULE_EVENT': {
          if (!assignedEmployee) return null;
          const title = (intent.title?.trim()
            || `Visit: ${foundCompany?.name ?? 'Client'} — ${assignedEmployee.firstName}`).substring(0, 200);
          await this.companyCalendar.create({
            title,
            description: intent.reason?.toString().trim().substring(0, 500) || undefined,
            eventType: intent.action === 'ASSIGN_VISIT' ? 'CLIENT_VISIT' : 'INTERNAL_MEETING',
            startDate: when.toISOString(),
            allDay: true,
            companyId: foundCompany?.id,
            assignedTo: assignedEmployee.id,
          }, userId);
          return `Done — I've scheduled "${title}" for ${when.toLocaleDateString('en-IN')}, assigned it to ${assignedEmployee.firstName} ${assignedEmployee.lastName}, added it to both calendars, and sent them a notification.`;
        }

        case 'CREATE_FOLLOW_UP': {
          if (!foundCompany) return null;
          const reason = (intent.reason ?? intent.title ?? question).toString().trim().substring(0, 500);
          const task = await this.prisma.followUpTask.create({
            data: {
              companyId: foundCompany.id,
              assignedTo: assignedEmployee?.id ?? userId,
              dueDate: when,
              reason,
            },
          });
          await this.prisma.companyTimelineEntry.create({
            data: {
              companyId: foundCompany.id,
              entryType: 'PENDING_TASK',
              title: `AI created follow-up${assignedEmployee ? ` for ${assignedEmployee.firstName} ${assignedEmployee.lastName}` : ''}`,
              description: reason,
              employeeId: userId,
              referenceId: task.id,
              referenceType: 'FollowUpTask',
              entryDate: new Date(),
            },
          });
          if (assignedEmployee) {
            const notification = await this.notifications.send(
              assignedEmployee.id,
              'GENERAL',
              `New follow-up: ${foundCompany.name}`,
              reason,
              task.id,
              'FollowUpTask',
            );
            this.notificationsGateway.sendToEmployee(assignedEmployee.id, 'follow-up:assigned', { notification, task });
          }
          return `Done — I've created a follow-up task on ${foundCompany.name} due ${when.toLocaleDateString('en-IN')}${assignedEmployee ? `, assigned to ${assignedEmployee.firstName} ${assignedEmployee.lastName} (notified)` : ''}.`;
        }

        case 'UPDATE_COMPANY_NOTE': {
          if (!foundCompany) return null;
          const stage = (intent.title?.trim() || intent.reason?.trim() || '').toString();
          if (!stage) return null;
          await this.prisma.clientCompany.update({
            where: { id: foundCompany.id },
            data: { currentStage: stage.substring(0, 200) },
          });
          await this.prisma.companyTimelineEntry.create({
            data: {
              companyId: foundCompany.id,
              entryType: 'STATUS_CHANGE',
              title: 'AI updated company stage from chat',
              description: stage,
              employeeId: userId,
              entryDate: new Date(),
            },
          });
          return `Done — I've updated ${foundCompany.name}'s current stage to "${stage}".`;
        }

        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private async recordOperationalUpdate(question: string, userId: string) {
    if (!this.looksLikeOperationalUpdate(question)) return null;

    const isMeetingMinutes = this.looksLikeMeetingMinutes(question);
    const communicationType = this.getCommunicationType(question);
    const extracted = isMeetingMinutes
      ? await this.gemini.extractMeetingNote(question)
      : await this.gemini.structureWorkUpdate(question);
    const companyName =
      typeof extracted.companyName === 'string' && extracted.companyName.trim()
        ? extracted.companyName.trim()
        : null;

    const foundCompany = await this.resolveCompany(question, companyName);
    const assignedEmployee = await this.resolveEmployee(question, extracted.assignedTo ?? null);

    const updateDate = new Date();
    if (communicationType && foundCompany) {
      await this.aiProposals.create({
        proposalType: 'CLIENT_COMMUNICATION',
        submittedBy: userId,
        rawInput: question,
        targetEntity: 'ClientCommunication',
        targetEntityId: foundCompany.id,
        aiReason: extracted.nextAction ?? extracted.followUpAction ?? extracted.pendingTask ?? null,
        proposedData: {
          companyId: foundCompany.id,
          type: communicationType,
          commDate: updateDate.toISOString(),
          summary: question,
          outcome: extracted.currentStatus ?? extracted.workStatus ?? null,
          nextAction: extracted.followUpAction ?? extracted.nextAction ?? extracted.pendingTask ?? null,
          createdBy: userId,
        },
      });
    }

    if (isMeetingMinutes) {
      const proposal = await this.aiProposals.create({
        proposalType: 'MEETING_NOTE',
        submittedBy: userId,
        rawInput: question,
        targetEntity: 'MeetingNote',
        targetEntityId: foundCompany?.id ?? null,
        aiReason: extracted.followUpAction ?? extracted.pendingGap ?? null,
        proposedData: {
          enteredBy: userId,
          companyId: foundCompany?.id ?? null,
          meetingDate: updateDate.toISOString(),
          extractedData: extracted,
          companyName: companyName ?? foundCompany?.name ?? null,
          employeeName: extracted.employeeName ?? null,
          workDiscussed: extracted.workDiscussed ?? null,
          assignedTo: extracted.assignedTo ?? assignedEmployee?.firstName ?? null,
          deadline: extracted.deadline ? new Date(extracted.deadline).toISOString() : this.parseDueDate(question).toISOString(),
          currentStatus: extracted.currentStatus ?? null,
          pendingGap: extracted.pendingGap ?? null,
          followUpAction: extracted.followUpAction ?? extracted.pendingGap ?? null,
          priorityLevel: extracted.priorityLevel ?? (question.toLowerCase().includes('urgent') ? 'HIGH' : 'MEDIUM'),
          ownerNote: extracted.ownerNote ?? null,
        },
      });

      return {
        updateId: proposal.id,
        updateType: 'meeting note proposal',
        companyName: foundCompany?.name ?? companyName,
        needsAdminReview: true,
      };
    }

    const proposal = await this.aiProposals.create({
      proposalType: 'WORK_UPDATE',
      submittedBy: userId,
      rawInput: question,
      targetEntity: 'WorkUpdate',
      targetEntityId: foundCompany?.id ?? null,
      aiReason: extracted.nextAction ?? extracted.pendingTask ?? null,
      proposedData: {
        employeeId: userId,
        companyId: foundCompany?.id ?? null,
        updateDate: updateDate.toISOString(),
        extractedData: extracted,
        companyName: companyName ?? foundCompany?.name ?? null,
        taskCompleted: extracted.taskCompleted ?? null,
        pendingTask: extracted.pendingTask ?? null,
        progress: extracted.progress ?? null,
        contribution: extracted.contribution ?? null,
        workStatus: extracted.workStatus ?? null,
        nextAction: extracted.nextAction ?? null,
      },
    });

    return {
      updateId: proposal.id,
      updateType: 'work update proposal',
      companyName: foundCompany?.name ?? companyName,
      needsAdminReview: true,
    };

  }

  async sendMessage(sessionId: string, question: string, userId: string, userEmail: string) {
    this.assertOwner(userEmail);

    const recordedUpdate = await this.recordOperationalUpdate(question, userId);
    const actionConfirmation = await this.tryExecuteAction(question, userId);
    const context = await this.buildContext();

    const prompt = `You are an intelligent operations assistant for Nexgen Pharma Solutions, a pharma consultation team.
You help Pratham/Ashwani monitor clients, team updates, pending gaps, follow-ups, audits, and service quality.
Use ONLY the live EMS data shown below. Be concise, direct, and actionable.
When a client issue is mentioned, identify the likely company, summarize what is known, highlight risks/gaps, and suggest the next operational action.
If the data does not contain the answer, say what is missing and what should be captured in EMS.
MOM/team-discussion messages are queued as AI proposals for Pratham/SUPER_ADMIN approval before they become meeting notes, timelines, or follow-up tasks.
Work-update messages are queued as AI proposals for approval before they become shared database updates.
${recordedUpdate ? `\nThe owner's latest message was queued as a ${recordedUpdate.updateType}. Proposed company: ${recordedUpdate.companyName ?? 'needs review'}. Approval required: ${recordedUpdate.needsAdminReview}. Mention this briefly before analysis.` : ''}
${actionConfirmation ? `\nYou were asked to prepare an action and you queued it for approval. Lead your reply with this exact confirmation, verbatim: "${actionConfirmation}"` : ''}

${context}

OWNER'S QUESTION: ${question}`;

    const generated = await this.gemini.generateText(prompt);
    const answer = actionConfirmation && !generated.includes(actionConfirmation)
      ? `${actionConfirmation}\n\n${generated}`
      : generated;

    await this.prisma.aIChatMessage.createMany({
      data: [
        { sessionId, createdBy: userId, role: 'USER', content: question },
        { sessionId, createdBy: userId, role: 'AI', content: answer },
      ],
    });

    return { answer, sessionId };
  }

  async getHistory(sessionId: string, userId: string, userEmail: string) {
    this.assertOwner(userEmail);
    return this.prisma.aIChatMessage.findMany({
      where: { sessionId, createdBy: userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async clearHistory(sessionId: string, userId: string, userEmail: string) {
    this.assertOwner(userEmail);
    await this.prisma.aIChatMessage.deleteMany({
      where: { sessionId, createdBy: userId },
    });
    return { cleared: true };
  }
}
