import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';
import { differenceInDays, startOfWeek, endOfWeek, format } from 'date-fns';

@Injectable()
export class ManagementReviewService {
  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
  ) {}

  async getWeeklyReview() {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const companies = await this.prisma.clientCompany.findMany({
      where: { isArchived: false },
      include: {
        responsibleEmployee: { select: { id: true, firstName: true, lastName: true } },
        alerts: { where: { isResolved: false } },
        workUpdates: {
          where: { createdAt: { gte: weekStart } },
          select: { id: true, employeeId: true, companyName: true, taskCompleted: true },
        },
        projects: { select: { id: true, name: true, status: true, auditDate: true } },
      },
    });

    const urgentAttention = companies.filter(c =>
      c.criticality === 'HIGH' ||
      c.businessStatus === 'AT_RISK' ||
      c.alerts.some(a => a.severity === 'CRITICAL'),
    );

    const noRecentActivity = companies.filter(c => {
      const daysSinceComm = c.lastCommunicationDate
        ? differenceInDays(now, c.lastCommunicationDate)
        : 999;
      return daysSinceComm >= 15 && c.businessStatus !== 'LOST';
    });

    const upcomingAudits = companies
      .filter(c => c.nextAuditDate && differenceInDays(c.nextAuditDate, now) >= 0 && differenceInDays(c.nextAuditDate, now) <= 60)
      .sort((a, b) => differenceInDays(a.nextAuditDate!, now) - differenceInDays(b.nextAuditDate!, now));

    const auditReady = companies.filter(c =>
      c.businessStatus === 'ACTIVE' && c.criticality !== 'LOW' &&
      c.nextAuditDate && differenceInDays(c.nextAuditDate, now) <= 30,
    );

    const delayed = companies.filter(c => c.businessStatus === 'DELAYED' || c.businessStatus === 'AT_RISK');

    const allUpdates = await this.prisma.workUpdate.findMany({
      where: { createdAt: { gte: weekStart, lte: weekEnd } },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });

    const employeeMap: Record<string, { name: string; count: number; companies: string[] }> = {};
    for (const u of allUpdates) {
      const key = u.employeeId;
      if (!employeeMap[key]) {
        employeeMap[key] = {
          name: `${u.employee.firstName} ${u.employee.lastName}`,
          count: 0,
          companies: [],
        };
      }
      employeeMap[key].count++;
      if (u.companyName && !employeeMap[key].companies.includes(u.companyName)) {
        employeeMap[key].companies.push(u.companyName);
      }
    }

    const pendingMeetingNotes = await this.prisma.meetingNote.count({
      where: { needsAdminReview: true, adminReviewedBy: null },
    });

    const pendingWorkUpdates = await this.prisma.workUpdate.count({
      where: { needsAdminReview: true, reviewedBy: null },
    });

    const upcomingCalendarEvents = await this.prisma.calendarEvent.findMany({
      where: {
        startDate: { gte: now, lte: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) },
      },
      include: {
        company: { select: { name: true } },
        assignee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 10,
    });

    return {
      weekRange: {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(weekEnd, 'yyyy-MM-dd'),
      },
      summary: {
        totalCompanies: companies.length,
        active: companies.filter(c => c.businessStatus === 'ACTIVE').length,
        atRisk: companies.filter(c => c.businessStatus === 'AT_RISK').length,
        dormant: companies.filter(c => c.businessStatus === 'DORMANT').length,
        lost: companies.filter(c => c.businessStatus === 'LOST').length,
        updatesThisWeek: allUpdates.length,
        pendingMeetingNotes,
        pendingWorkUpdates,
      },
      urgentAttention: urgentAttention.map(c => ({
        id: c.id,
        name: c.name,
        businessStatus: c.businessStatus,
        criticality: c.criticality,
        riskScore: c.riskScore,
        alerts: c.alerts,
        responsibleEmployee: c.responsibleEmployee,
      })),
      noRecentActivity: noRecentActivity.map(c => ({
        id: c.id,
        name: c.name,
        lastCommunicationDate: c.lastCommunicationDate,
        lastVisitDate: c.lastVisitDate,
        daysSinceComm: c.lastCommunicationDate ? differenceInDays(now, c.lastCommunicationDate) : null,
        responsibleEmployee: c.responsibleEmployee,
      })),
      upcomingAudits: upcomingAudits.map(c => ({
        id: c.id,
        name: c.name,
        nextAuditDate: c.nextAuditDate,
        daysUntilAudit: differenceInDays(c.nextAuditDate!, now),
        criticality: c.criticality,
        projects: c.projects,
      })),
      auditReady,
      delayed,
      employeeContributions: Object.values(employeeMap).sort((a, b) => b.count - a.count),
      upcomingCalendarEvents,
    };
  }

  async getAIRecommendations(): Promise<string> {
    const review = await this.getWeeklyReview();

    return this.gemini.generateWeeklyOwnerSummary({
      totalCompanies: review.summary.totalCompanies,
      activeCompanies: review.summary.active,
      atRiskCompanies: review.urgentAttention.map(c => c.name),
      dormantCompanies: [],
      upcomingAudits: review.upcomingAudits.map(c => ({
        company: c.name,
        date: c.nextAuditDate ? format(c.nextAuditDate, 'yyyy-MM-dd') : '',
      })),
      employeeContributions: review.employeeContributions.map(e => ({
        name: e.name,
        updates: e.count,
      })),
      noRecentActivity: review.noRecentActivity.map(c => c.name),
      pendingMeetingReviews: review.summary.pendingMeetingNotes,
    });
  }
}
