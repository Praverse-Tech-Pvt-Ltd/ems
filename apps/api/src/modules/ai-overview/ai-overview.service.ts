import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from './gemini.service';
import { differenceInDays, startOfWeek, endOfWeek } from 'date-fns';

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

  isOwner(employeeId: string): boolean {
    return this.ownerIds.includes(employeeId);
  }

  private assertOwner(employeeId: string) {
    if (!this.isOwner(employeeId)) {
      throw new ForbiddenException('This feature is available to owners only');
    }
  }

  async getOwnerDashboard(requesterId: string) {
    this.assertOwner(requesterId);

    const now = new Date();
    const companies = await this.prisma.clientCompany.findMany({
      where: { isArchived: false },
      include: {
        responsibleEmployee: { select: { id: true, firstName: true, lastName: true } },
        workUpdates: { orderBy: { createdAt: 'desc' }, take: 3 },
        meetingNotes: { orderBy: { createdAt: 'desc' }, take: 2 },
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

      return {
        ...c,
        daysSinceVisit,
        daysSinceComm,
        daysToAudit,
        visitAlert,
        activeAlerts: c.alerts.length,
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

    return {
      companies: enriched,
      summary: {
        total: enriched.length,
        active: enriched.filter(c => c.businessStatus === 'ACTIVE').length,
        atRisk: enriched.filter(c => c.businessStatus === 'AT_RISK').length,
        dormant: enriched.filter(c => c.businessStatus === 'DORMANT').length,
        lost: enriched.filter(c => c.businessStatus === 'LOST').length,
        high: enriched.filter(c => c.criticality === 'HIGH').length,
      },
      needsImmediateAttention,
      notVisitedRecently,
      upcomingAudits,
      employeeContributions,
      pendingMeetingReviews,
    };
  }

  async getWeeklyAISummary(requesterId: string): Promise<string> {
    this.assertOwner(requesterId);
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

  async getEmployeeWorkMap(requesterId: string) {
    this.assertOwner(requesterId);

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
