import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from './gemini.service';
import { differenceInDays, startOfWeek, endOfWeek } from 'date-fns';

// Owner emails — stable across DB reseeds
const OWNER_EMAILS = [
  'ashwani@nexgenpharmasolutions.com',
  'pratham.s@nexgenpharmasolutions.com',
];

@Injectable()
export class AIOverviewService {
  private ownerIds: string[];

  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
    private config: ConfigService,
  ) {
    const raw = this.config.get<string>('OWNER_EMPLOYEE_IDS', '');
    this.ownerIds = raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  isOwner(employeeId: string, email?: string): boolean {
    // Primary check: email (stable across reseeds)
    if (email && OWNER_EMAILS.includes(email.toLowerCase())) return true;
    // Fallback: ID from env
    if (this.ownerIds.length > 0 && this.ownerIds.includes(employeeId)) return true;
    return false;
  }

  private assertOwner(employeeId: string, email?: string) {
    if (!this.isOwner(employeeId, email)) {
      throw new ForbiddenException('This feature is available to owners only');
    }
  }

  async getOwnerDashboard(requesterId: string, requesterEmail?: string) {
    this.assertOwner(requesterId, requesterEmail);

    const now = new Date();
    const companies = await this.prisma.clientCompany.findMany({
      where: { isArchived: false },
      include: {
        responsibleEmployee: { select: { id: true, firstName: true, lastName: true } },
        workUpdates: { orderBy: { createdAt: 'desc' }, take: 3 },
        meetingNotes: { orderBy: { createdAt: 'desc' }, take: 2 },
        followUpTasks: {
          where: { status: { in: ['OPEN', 'SNOOZED'] as any } },
          orderBy: { dueDate: 'asc' },
          take: 5,
          include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
        },
        alerts: { where: { isResolved: false } },
      },
      orderBy: [{ criticality: 'asc' }, { businessStatus: 'asc' }],
    });

    const alertMild = parseInt(this.config.get('ALERT_MILD_DAYS', '7'));
    const alertModerate = parseInt(this.config.get('ALERT_MODERATE_DAYS', '15'));
    const alertCritical = parseInt(this.config.get('ALERT_CRITICAL_DAYS', '30'));
    const alertVisit = parseInt(this.config.get('ALERT_VISIT_DAYS', '45'));

    const enriched = companies.map(c => {
      const daysSinceVisit = c.lastVisitDate
        ? differenceInDays(now, c.lastVisitDate)
        : null;
      const daysSinceComm = c.lastCommunicationDate
        ? differenceInDays(now, c.lastCommunicationDate)
        : null;
      const daysToAudit = c.nextAuditDate
        ? differenceInDays(c.nextAuditDate, now)
        : null;

      const visitAlert =
        daysSinceVisit === null ? null
        : daysSinceVisit >= alertVisit ? 'CRITICAL'
        : daysSinceVisit >= alertCritical ? 'CRITICAL'
        : daysSinceVisit >= alertModerate ? 'MODERATE'
        : daysSinceVisit >= alertMild ? 'MILD'
        : null;

      const hasStuckWork = c.workUpdates.some(
        (update) =>
          update.workStatus?.toLowerCase().includes('blocked') ||
          update.pendingTask ||
          update.nextAction,
      );
      const openFollowUps = c.followUpTasks.length;
      const health =
        c.businessStatus === 'LOST' || c.businessStatus === 'AT_RISK' || c.alerts.some(a => a.severity === 'CRITICAL')
          ? 'RED'
          : c.businessStatus === 'DORMANT' ||
            c.businessStatus === 'DELAYED' ||
            c.criticality === 'HIGH' ||
            openFollowUps > 0 ||
            hasStuckWork ||
            (daysSinceComm !== null && daysSinceComm >= alertMild)
            ? 'YELLOW'
            : 'GREEN';

      return {
        ...c,
        daysSinceVisit,
        daysSinceComm,
        daysToAudit,
        visitAlert,
        activeAlerts: c.alerts.length,
        openFollowUps,
        hasStuckWork,
        health,
      };
    });

    const needsImmediateAttention = enriched.filter(
      c =>
        c.criticality === 'HIGH' ||
        c.businessStatus === 'AT_RISK' ||
        (c.daysToAudit !== null && c.daysToAudit <= 30) ||
        c.activeAlerts > 0,
    );

    const notVisitedRecently = enriched.filter(
      c => c.daysSinceVisit !== null && c.daysSinceVisit >= alertCritical,
    );

    const upcomingAudits = enriched
      .filter(c => c.daysToAudit !== null && c.daysToAudit >= 0 && c.daysToAudit <= 60)
      .sort((a, b) => (a.daysToAudit ?? 999) - (b.daysToAudit ?? 999));

    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const employeeUpdates = await this.prisma.workUpdate.groupBy({
      by: ['employeeId'],
      where: { createdAt: { gte: weekStart, lte: weekEnd } },
      _count: { id: true },
    });

    const employeeIds = employeeUpdates.map(e => e.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const employeeContributions = employeeUpdates.map(e => {
      const emp = employees.find(em => em.id === e.employeeId);
      return {
        employeeId: e.employeeId,
        name: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
        updates: e._count.id,
      };
    });

    const pendingMeetingReviews = await this.prisma.meetingNote.count({
      where: { needsAdminReview: true, adminReviewedBy: null },
    });

    const openFollowUps = await this.prisma.followUpTask.findMany({
      where: { status: { in: ['OPEN', 'SNOOZED'] as any } },
      include: {
        company: { select: { id: true, name: true, criticality: true, businessStatus: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    });

    const repeatedIssues = enriched
      .map((company) => {
        const issueTexts = [
          ...company.workUpdates.map((u) => u.pendingTask ?? u.workStatus ?? ''),
          ...company.meetingNotes.map((m) => m.pendingGap ?? m.followUpAction ?? ''),
          ...company.alerts.map((a) => a.message),
        ].filter(Boolean);
        const repeated = ['delay', 'pending', 'blocked', 'document', 'audit', 'dossier', 'query', 'follow']
          .map((keyword) => ({
            keyword,
            count: issueTexts.filter((text) => text.toLowerCase().includes(keyword)).length,
          }))
          .filter((item) => item.count >= 2);
        return repeated.length ? { companyId: company.id, company: company.name, repeated } : null;
      })
      .filter(Boolean);

    const teamWorkload = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        designation: true,
        companiesResponsible: {
          where: { isArchived: false },
          select: { id: true, name: true, businessStatus: true, criticality: true },
        },
        followUpTasksAssigned: {
          where: { status: { in: ['OPEN', 'SNOOZED'] as any } },
          select: { id: true, dueDate: true, reason: true, company: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const dailyBriefing = {
      atRiskClients: needsImmediateAttention.slice(0, 8).map(c => c.name),
      stuckWork: enriched.filter(c => c.hasStuckWork).slice(0, 8).map(c => c.name),
      overdueFollowUps: openFollowUps.filter(task => task.dueDate < now).map(task => ({
        company: task.company.name,
        assignee: `${task.assignee.firstName} ${task.assignee.lastName}`,
        dueDate: task.dueDate,
        reason: task.reason,
      })),
      nextCalls: enriched
        .filter(c => c.openFollowUps > 0 || c.health !== 'GREEN')
        .slice(0, 8)
        .map(c => ({
          companyId: c.id,
          company: c.name,
          callSummary: [
            `Health: ${c.health}`,
            `Status: ${c.businessStatus}`,
            c.followUpTasks[0]?.reason ? `Follow-up: ${c.followUpTasks[0].reason}` : null,
            c.meetingNotes[0]?.pendingGap ? `Pending gap: ${c.meetingNotes[0].pendingGap}` : null,
            c.workUpdates[0]?.pendingTask ? `Pending task: ${c.workUpdates[0].pendingTask}` : null,
          ].filter(Boolean).join(' | '),
        })),
    };

    return {
      companies: enriched,
      summary: {
        total: enriched.length,
        active: enriched.filter(c => c.businessStatus === 'ACTIVE').length,
        atRisk: enriched.filter(c => c.businessStatus === 'AT_RISK').length,
        dormant: enriched.filter(c => c.businessStatus === 'DORMANT').length,
        lost: enriched.filter(c => c.businessStatus === 'LOST').length,
        high: enriched.filter(c => c.criticality === 'HIGH').length,
        green: enriched.filter(c => c.health === 'GREEN').length,
        yellow: enriched.filter(c => c.health === 'YELLOW').length,
        red: enriched.filter(c => c.health === 'RED').length,
      },
      needsImmediateAttention,
      notVisitedRecently,
      upcomingAudits,
      employeeContributions,
      pendingMeetingReviews,
      openFollowUps,
      repeatedIssues,
      teamWorkload,
      dailyBriefing,
    };
  }

  async getWeeklyAISummary(requesterId: string, requesterEmail?: string): Promise<string> {
    this.assertOwner(requesterId, requesterEmail);
    const dashboard = await this.getOwnerDashboard(requesterId);

    const summary = await this.gemini.generateWeeklyOwnerSummary({
      totalCompanies: dashboard.summary.total,
      activeCompanies: dashboard.summary.active,
      atRiskCompanies: dashboard.needsImmediateAttention.map((c: any) => c.name),
      dormantCompanies: dashboard.companies
        .filter((c: any) => c.businessStatus === 'DORMANT')
        .map((c: any) => c.name),
      upcomingAudits: dashboard.upcomingAudits.map((c: any) => ({
        company: c.name,
        date: c.nextAuditDate?.toISOString().split('T')[0] ?? '',
      })),
      employeeContributions: dashboard.employeeContributions,
      noRecentActivity: dashboard.notVisitedRecently.map((c: any) => c.name),
      pendingMeetingReviews: dashboard.pendingMeetingReviews,
    });

    await this.prisma.aISummary.create({
      data: {
        summaryType: 'WEEKLY_OWNER',
        content: summary,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return summary;
  }

  async getEmployeeWorkMap(requesterId: string, requesterEmail?: string) {
    this.assertOwner(requesterId, requesterEmail);

    const updates = await this.prisma.workUpdate.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, designation: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byEmployee: Record<string, any> = {};
    for (const u of updates) {
      const key = u.employeeId;
      if (!byEmployee[key]) {
        byEmployee[key] = {
          employee: u.employee,
          companies: [],
          updateCount: 0,
          updates: [],
        };
      }
      byEmployee[key].updateCount++;
      byEmployee[key].updates.push(u);
      if (u.company && !byEmployee[key].companies.find((c: any) => c.id === u.company!.id)) {
        byEmployee[key].companies.push(u.company);
      }
    }

    return Object.values(byEmployee);
  }
}
