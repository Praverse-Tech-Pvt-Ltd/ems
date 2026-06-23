import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';
import { differenceInDays, startOfWeek, endOfWeek, format, subDays } from 'date-fns';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

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

  async getEmployeePerformanceReport(days = 30) {
    const since = subDays(new Date(), days);

    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, designation: true },
    });

    const [updates, visits, followUps] = await Promise.all([
      this.prisma.workUpdate.groupBy({
        by: ['employeeId', 'companyId'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),
      this.prisma.companyVisit.groupBy({
        by: ['visitedBy'],
        where: { visitDate: { gte: since } },
        _count: { id: true },
      }),
      this.prisma.followUpTask.groupBy({
        by: ['assignedTo'],
        where: { status: 'DONE', completedAt: { gte: since } },
        _count: { id: true },
      }),
    ]);

    const report = employees.map(emp => {
      const empUpdates = updates.filter(u => u.employeeId === emp.id);
      const companiesCovered = new Set(empUpdates.map(u => u.companyId).filter(Boolean)).size;
      const updatesCount = empUpdates.reduce((s, u) => s + u._count.id, 0);
      const visitCount = visits.find(v => v.visitedBy === emp.id)?._count.id ?? 0;
      const followUpCompleted = followUps.find(f => f.assignedTo === emp.id)?._count.id ?? 0;

      return {
        employee: { id: emp.id, name: `${emp.firstName} ${emp.lastName}`, designation: emp.designation },
        updatesCount,
        companiesCovered,
        visitCount,
        followUpCompleted,
        activityScore: updatesCount * 2 + visitCount * 5 + followUpCompleted * 3,
      };
    }).sort((a, b) => b.activityScore - a.activityScore);

    const topText = report.slice(0, 3).map(r =>
      `${r.employee.name}: ${r.updatesCount} updates, ${r.visitCount} visits, ${r.followUpCompleted} follow-ups`
    ).join('; ');

    const aiSummary = await this.gemini.generateText(
      `In 2-3 sentences, summarize this team performance data for Nexgen Pharma Solutions management: ${topText}. Focus on highlights and any gaps.`
    );

    return { report, days, aiSummary };
  }

  async exportPdf(): Promise<Buffer> {
    const review = await this.getWeeklyReview();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.rect(0, 0, doc.page.width, 55).fill('#1a1a1a');
      doc.fillColor('white').font('Helvetica-Bold').fontSize(13)
        .text('NEXGEN PHARMA SOLUTIONS', 40, 12);
      doc.font('Helvetica').fontSize(9).fillColor('#ffa23a')
        .text('WEEKLY MANAGEMENT REVIEW', 40, 29);
      doc.fillColor('#aaa').fontSize(8)
        .text(`Week: ${review.weekRange.start} to ${review.weekRange.end}`, 40, 42);

      doc.fillColor('#1a1a1a').moveDown(2.5);

      // Summary KPIs
      const kpiData = [
        { l: 'Companies', v: review.summary.totalCompanies },
        { l: 'Active',    v: review.summary.active },
        { l: 'At Risk',   v: review.summary.atRisk },
        { l: 'Dormant',   v: review.summary.dormant },
        { l: 'Updates',   v: review.summary.updatesThisWeek },
      ];
      const ky = doc.y;
      kpiData.forEach((k, i) => {
        const x = 40 + i * 103;
        doc.rect(x, ky, 96, 34).fillAndStroke('#f5f0e8', '#1a1a1a');
        doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(16)
          .text(String(k.v), x + 5, ky + 4, { width: 86, align: 'center' });
        doc.font('Helvetica').fontSize(7).fillColor('#888')
          .text(k.l.toUpperCase(), x + 5, ky + 23, { width: 86, align: 'center' });
      });
      doc.moveDown(3);

      const section = (title: string) => {
        if (doc.y > doc.page.height - 100) doc.addPage();
        doc.rect(40, doc.y, doc.page.width - 80, 16).fill('#1a1a1a');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
          .text(title, 46, doc.y - 12);
        doc.moveDown(0.6);
      };

      const row = (label: string, value: string, urgent = false) => {
        doc.font('Helvetica').fontSize(8.5).fillColor(urgent ? '#e63b2e' : '#1a1a1a')
          .text(`• ${label}`, 45, doc.y, { continued: true })
          .fillColor('#555').text(`  ${value}`);
        doc.moveDown(0.1);
      };

      // Urgent attention
      if (review.urgentAttention.length > 0) {
        section('URGENT ATTENTION');
        review.urgentAttention.forEach((c: any) => row(c.name, `${c.businessStatus} | Risk: ${c.riskScore}`, true));
        doc.moveDown(0.4);
      }

      // Upcoming audits
      if (review.upcomingAudits.length > 0) {
        section('UPCOMING AUDITS (60 DAYS)');
        review.upcomingAudits.forEach((c: any) =>
          row(c.name, `${c.daysUntilAudit === 0 ? 'TODAY' : c.daysUntilAudit + ' days'} — ${format(new Date(c.nextAuditDate), 'dd MMM yyyy')}`, c.daysUntilAudit <= 14)
        );
        doc.moveDown(0.4);
      }

      // No recent activity
      if (review.noRecentActivity.length > 0) {
        section('NO RECENT ACTIVITY');
        review.noRecentActivity.forEach((c: any) =>
          row(c.name, `${c.daysSinceComm ?? '?'} days since last comm`, (c.daysSinceComm ?? 0) >= 30)
        );
        doc.moveDown(0.4);
      }

      // Employee contributions
      if (review.employeeContributions.length > 0) {
        section('EMPLOYEE CONTRIBUTIONS (THIS WEEK)');
        review.employeeContributions.forEach((e: any) =>
          row(e.name, `${e.count} updates · ${e.companies.join(', ') || 'No company tagged'}`)
        );
      }

      doc.fillColor('#888').font('Helvetica').fontSize(7)
        .text(`Generated by NexGen EMS · ${new Date().toISOString()}`, 40, doc.page.height - 30,
          { align: 'center', width: doc.page.width - 80 });

      doc.end();
    });
  }

  async exportExcel(): Promise<Buffer> {
    const companies = await this.prisma.clientCompany.findMany({
      where: { isArchived: false },
      include: { responsibleEmployee: { select: { firstName: true, lastName: true } } },
      orderBy: [{ criticality: 'asc' }, { riskScore: 'desc' }],
    });

    const rows = companies.map(c => ({
      'Company': c.name,
      'Status': c.businessStatus,
      'Priority': c.criticality,
      'Risk Score': c.riskScore,
      'Current Stage': c.currentStage ?? '',
      'Responsible': c.responsibleEmployee ? `${c.responsibleEmployee.firstName} ${c.responsibleEmployee.lastName}` : '',
      'Last Visit': c.lastVisitDate ? format(c.lastVisitDate, 'dd MMM yyyy') : '',
      'Last Communication': c.lastCommunicationDate ? format(c.lastCommunicationDate, 'dd MMM yyyy') : '',
      'Next Audit': c.nextAuditDate ? format(c.nextAuditDate, 'dd MMM yyyy') : '',
      'Notes': c.notes ?? '',
    }));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Companies');
    sheet.columns = [
      { header: 'Company', key: 'Company', width: 20 },
      { header: 'Status', key: 'Status', width: 12 },
      { header: 'Priority', key: 'Priority', width: 10 },
      { header: 'Risk Score', key: 'Risk Score', width: 8 },
      { header: 'Current Stage', key: 'Current Stage', width: 20 },
      { header: 'Responsible', key: 'Responsible', width: 20 },
      { header: 'Last Visit', key: 'Last Visit', width: 15 },
      { header: 'Last Communication', key: 'Last Communication', width: 18 },
      { header: 'Next Audit', key: 'Next Audit', width: 15 },
      { header: 'Notes', key: 'Notes', width: 30 },
    ];
    sheet.addRows(rows);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
