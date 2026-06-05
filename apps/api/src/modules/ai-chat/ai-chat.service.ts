import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';
import { differenceInDays } from 'date-fns';

const OWNER_EMAILS = [
  'ashwani@nexgenpharmasolutions.com',
  'pratham.s@nexgenpharmasolutions.com',
];

@Injectable()
export class AIChatService {
  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
  ) {}

  private assertOwner(email: string) {
    if (!OWNER_EMAILS.includes(email.toLowerCase())) {
      throw new ForbiddenException('AI Chat is restricted to owners only');
    }
  }

  private async buildContext(): Promise<string> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [companies, recentUpdates, openAlerts, openFollowUps] = await Promise.all([
      this.prisma.clientCompany.findMany({
        where: { isArchived: false },
        include: {
          responsibleEmployee: { select: { firstName: true, lastName: true } },
          projects: { select: { name: true, auditDate: true, auditType: true } },
        },
        orderBy: { criticality: 'asc' },
      }),
      this.prisma.workUpdate.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        include: {
          employee: { select: { firstName: true, lastName: true } },
          company: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.companyAlert.findMany({
        where: { isResolved: false },
        include: { company: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      this.prisma.followUpTask.findMany({
        where: { status: 'OPEN' },
        include: {
          company: { select: { name: true } },
          assignee: { select: { firstName: true, lastName: true } },
        },
        take: 15,
      }),
    ]);

    const lines: string[] = ['=== NEXGEN EMS LIVE DATA ===', `Date: ${now.toISOString().split('T')[0]}`, ''];

    lines.push('--- COMPANIES ---');
    for (const c of companies) {
      const daysSinceVisit = c.lastVisitDate ? differenceInDays(now, c.lastVisitDate) : null;
      const daysSinceComm = c.lastCommunicationDate ? differenceInDays(now, c.lastCommunicationDate) : null;
      const daysToAudit = c.nextAuditDate ? differenceInDays(c.nextAuditDate, now) : null;
      const resp = c.responsibleEmployee ? `${c.responsibleEmployee.firstName} ${c.responsibleEmployee.lastName}` : 'Unassigned';
      const auditInfo = c.projects.map(p => p.auditDate ? `${p.auditType ?? 'Audit'} on ${new Date(p.auditDate).toISOString().split('T')[0]}` : '').filter(Boolean).join(', ');
      lines.push(`• ${c.name} | ${c.businessStatus} | ${c.criticality} PRIORITY | Risk:${c.riskScore} | Resp:${resp} | LastVisit:${daysSinceVisit !== null ? daysSinceVisit + 'd ago' : 'never'} | LastComm:${daysSinceComm !== null ? daysSinceComm + 'd ago' : 'never'}${daysToAudit !== null ? ` | Audit in ${daysToAudit}d` : ''}${auditInfo ? ` | ${auditInfo}` : ''}`);
    }

    if (openAlerts.length > 0) {
      lines.push('', '--- OPEN ALERTS ---');
      for (const a of openAlerts) {
        lines.push(`• [${a.severity}] ${a.company.name}: ${a.message}`);
      }
    }

    if (openFollowUps.length > 0) {
      lines.push('', '--- OPEN FOLLOW-UP TASKS ---');
      for (const f of openFollowUps) {
        lines.push(`• ${f.company.name} → ${f.assignee.firstName} ${f.assignee.lastName}: ${f.reason} (due ${new Date(f.dueDate).toISOString().split('T')[0]})`);
      }
    }

    if (recentUpdates.length > 0) {
      lines.push('', '--- RECENT WORK UPDATES (7 days) ---');
      for (const u of recentUpdates) {
        const name = `${u.employee.firstName} ${u.employee.lastName}`;
        lines.push(`• ${u.company?.name ?? '?'} / ${name}: ${u.rawText.substring(0, 100)}`);
      }
    }

    return lines.join('\n');
  }

  async sendMessage(sessionId: string, question: string, userId: string, userEmail: string) {
    this.assertOwner(userEmail);

    const context = await this.buildContext();

    const prompt = `You are an intelligent assistant for Nexgen Pharma Solutions, a pharma consultancy.
You have access to live EMS data shown below. Answer the owner's question using ONLY this data.
Be concise, direct, and actionable. If the data doesn't contain the answer, say so clearly.

${context}

OWNER'S QUESTION: ${question}`;

    const answer = await this.gemini.generateText(prompt);

    await this.prisma.aIChatMessage.createMany({
      data: [
        { sessionId, role: 'user',      content: question, createdBy: userId },
        { sessionId, role: 'assistant', content: answer,   createdBy: userId },
      ],
    });

    return { answer, sessionId };
  }

  async getHistory(sessionId: string, userId: string, userEmail: string) {
    this.assertOwner(userEmail);
    // Scope to requesting user's own messages only
    return this.prisma.aIChatMessage.findMany({
      where: { sessionId, createdBy: userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async clearHistory(sessionId: string, userId: string, userEmail: string) {
    this.assertOwner(userEmail);
    // Only delete messages belonging to requesting user
    await this.prisma.aIChatMessage.deleteMany({
      where: { sessionId, createdBy: userId },
    });
    return { cleared: true };
  }
}
