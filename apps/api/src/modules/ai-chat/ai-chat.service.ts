import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';
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
      const communication = await this.prisma.clientCommunication.create({
        data: {
          companyId: foundCompany.id,
          type: communicationType as any,
          commDate: updateDate,
          summary: question,
          outcome: extracted.currentStatus ?? extracted.workStatus ?? null,
          nextAction: extracted.followUpAction ?? extracted.nextAction ?? extracted.pendingTask ?? null,
          createdBy: userId,
        },
      });

      await this.prisma.companyTimelineEntry.create({
        data: {
          companyId: foundCompany.id,
          entryType: communicationType === 'WHATSAPP' ? 'CLIENT_CALL' : 'CLIENT_CALL',
          title: `AI logged ${communicationType.toLowerCase()} communication`,
          description: question.substring(0, 200),
          employeeId: userId,
          referenceId: communication.id,
          referenceType: 'ClientCommunication',
          entryDate: updateDate,
        },
      });

      await this.syncCompanyFromActivity(foundCompany.id, updateDate, extracted, question);
    }

    if (isMeetingMinutes) {
      const note = await this.prisma.meetingNote.create({
        data: {
          enteredBy: userId,
          companyId: foundCompany?.id ?? null,
          rawText: question,
          meetingDate: updateDate,
          extractedData: extracted as any,
          companyName: companyName ?? foundCompany?.name ?? null,
          employeeName: extracted.employeeName ?? null,
          workDiscussed: extracted.workDiscussed ?? null,
          assignedTo: extracted.assignedTo ?? assignedEmployee?.firstName ?? null,
          deadline: extracted.deadline ? new Date(extracted.deadline) : this.parseDueDate(question),
          currentStatus: extracted.currentStatus ?? null,
          pendingGap: extracted.pendingGap ?? null,
          followUpAction: extracted.followUpAction ?? extracted.pendingGap ?? null,
          priorityLevel: extracted.priorityLevel ?? (question.toLowerCase().includes('urgent') ? 'HIGH' : 'MEDIUM'),
          ownerNote: extracted.ownerNote ?? null,
          needsAdminReview: !foundCompany || !assignedEmployee,
        },
      });

      if (foundCompany) {
        await this.prisma.companyTimelineEntry.create({
          data: {
            companyId: foundCompany.id,
            entryType: 'MEETING_NOTE',
            title: `AI MOM: ${(extracted.workDiscussed ?? question).substring(0, 60)}`,
            description: extracted.followUpAction ?? extracted.pendingGap ?? question.substring(0, 200),
            employeeId: userId,
            referenceId: note.id,
            referenceType: 'MeetingNote',
            entryDate: updateDate,
          },
        });

        await this.syncCompanyFromActivity(foundCompany.id, updateDate, extracted, question);

        if (assignedEmployee && (extracted.followUpAction || extracted.pendingGap || /\bassign\b/i.test(question))) {
          const assignedReason =
            /\bassign\b/i.test(question)
              ? [
                  extracted.workDiscussed ? `Complete/review: ${extracted.workDiscussed}` : null,
                  extracted.pendingGap ? `Pending gap: ${extracted.pendingGap}` : null,
                  extracted.followUpAction ? `Next action: ${extracted.followUpAction}` : null,
                ].filter(Boolean).join(' | ') || question.substring(0, 250)
              : extracted.followUpAction ?? extracted.pendingGap ?? question.substring(0, 250);

          const task = await this.prisma.followUpTask.create({
            data: {
              companyId: foundCompany.id,
              assignedTo: assignedEmployee.id,
              dueDate: extracted.deadline ? new Date(extracted.deadline) : this.parseDueDate(question),
              reason: assignedReason,
            },
          });

          await this.prisma.companyTimelineEntry.create({
            data: {
              companyId: foundCompany.id,
              entryType: 'PENDING_TASK',
              title: `AI follow-up assigned to ${assignedEmployee.firstName} ${assignedEmployee.lastName}`,
              description: task.reason,
              employeeId: userId,
              referenceId: task.id,
              referenceType: 'FollowUpTask',
              entryDate: updateDate,
            },
          });
        }
      }

      return {
        updateId: note.id,
        updateType: 'meeting note',
        companyName: foundCompany?.name ?? companyName,
        needsAdminReview: note.needsAdminReview,
      };
    }

    const update = await this.prisma.workUpdate.create({
      data: {
        employeeId: userId,
        companyId: foundCompany?.id ?? null,
        rawText: question,
        updateDate,
        extractedData: extracted as any,
        companyName: companyName ?? foundCompany?.name ?? null,
        taskCompleted: extracted.taskCompleted ?? null,
        pendingTask: extracted.pendingTask ?? null,
        progress: extracted.progress ?? null,
        contribution: extracted.contribution ?? null,
        workStatus: extracted.workStatus ?? null,
        nextAction: extracted.nextAction ?? null,
        needsAdminReview: !foundCompany || String(extracted.needsAdminReview) === 'true',
      },
    });

    if (foundCompany) {
      await this.prisma.companyTimelineEntry.create({
        data: {
          companyId: foundCompany.id,
          entryType: 'EMPLOYEE_UPDATE',
          title: `AI chat update: ${(extracted.taskCompleted ?? question).substring(0, 60)}`,
          description: extracted.pendingTask ?? extracted.nextAction ?? question.substring(0, 200),
          employeeId: userId,
          referenceId: update.id,
          referenceType: 'WorkUpdate',
          entryDate: updateDate,
        },
      });

      await this.syncCompanyFromActivity(foundCompany.id, updateDate, extracted, question);
    }

    return {
      updateId: update.id,
      updateType: 'work update',
      companyName: foundCompany?.name ?? companyName,
      needsAdminReview: update.needsAdminReview,
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
MOM/team-discussion messages are automatically saved as meeting notes, linked to company timelines, and can create follow-up tasks when assignee/deadline/action is present.
Work-update messages are automatically saved as work updates and linked to company timelines.
${recordedUpdate ? `\nThe owner's latest message was saved as a ${recordedUpdate.updateType}. Saved company: ${recordedUpdate.companyName ?? 'needs review'}. Needs admin review: ${recordedUpdate.needsAdminReview}. Mention this briefly before analysis.` : ''}
${actionConfirmation ? `\nYou were asked to take an action and you ALREADY DID IT. Lead your reply with this exact confirmation, verbatim: "${actionConfirmation}"` : ''}

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
