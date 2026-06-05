import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';
import { StorageService } from '../../common/storage/storage.service';
import { differenceInDays } from 'date-fns';
import PDFDocument from 'pdfkit';

// ── Default checklists per audit type ────────────────────────────────────────
type ChecklistItem = { title: string; category: string };

const CHECKLISTS: Record<string, ChecklistItem[]> = {
  WHO: [
    { title: 'Site Master File (SMF) prepared and approved', category: 'Documentation' },
    { title: 'Quality Manual updated', category: 'Documentation' },
    { title: 'SOP list reviewed and approved', category: 'SOPs' },
    { title: 'Batch manufacturing records reviewed', category: 'Manufacturing' },
    { title: 'Product specification files complete', category: 'Documentation' },
    { title: 'Validation master plan current', category: 'Validation' },
    { title: 'Equipment qualification files ready', category: 'Validation' },
    { title: 'Cleaning validation reports available', category: 'Validation' },
    { title: 'Water system validation complete', category: 'Utilities' },
    { title: 'HVAC qualification done', category: 'Utilities' },
    { title: 'Stability data compiled', category: 'Quality' },
    { title: 'Change control log reviewed', category: 'Quality' },
    { title: 'CAPA log closed or documented', category: 'Quality' },
    { title: 'Deviation log reviewed', category: 'Quality' },
    { title: 'OOS/OOT investigation records ready', category: 'QC' },
    { title: 'Supplier qualification files in order', category: 'Supply Chain' },
    { title: 'Personnel training records updated', category: 'HR / Training' },
    { title: 'Internal audit reports available', category: 'Audit' },
    { title: 'Product quality reviews completed', category: 'Quality' },
    { title: 'Complaint and recall procedures in place', category: 'Quality' },
  ],
  GMP: [
    { title: 'GMP documentation index prepared', category: 'Documentation' },
    { title: 'SOPs for all critical processes approved', category: 'SOPs' },
    { title: 'Manufacturing process validated', category: 'Validation' },
    { title: 'Analytical method validation done', category: 'QC' },
    { title: 'Equipment calibration records current', category: 'Equipment' },
    { title: 'Preventive maintenance logs available', category: 'Equipment' },
    { title: 'Environmental monitoring data compiled', category: 'Facilities' },
    { title: 'Pest control records updated', category: 'Facilities' },
    { title: 'Raw material COA files complete', category: 'Supply Chain' },
    { title: 'Packaging material specifications ready', category: 'Supply Chain' },
    { title: 'Batch record review completed', category: 'Manufacturing' },
    { title: 'Finished product release procedure ready', category: 'QC' },
    { title: 'Stability program data available', category: 'Quality' },
    { title: 'CAPA effectiveness checks done', category: 'Quality' },
    { title: 'Training matrix updated', category: 'HR / Training' },
  ],
  CDSCO: [
    { title: 'Product registration dossiers ready', category: 'Regulatory' },
    { title: 'Manufacturing license copy available', category: 'Licensing' },
    { title: 'Drug license (Form 25 / 28) current', category: 'Licensing' },
    { title: 'GMP certificate valid and available', category: 'Licensing' },
    { title: 'Schedule M compliance checklist done', category: 'Compliance' },
    { title: 'Pharmacovigilance reports filed', category: 'Regulatory' },
    { title: 'Import/export permits in order', category: 'Regulatory' },
    { title: 'Label review against CDSCO guidelines', category: 'Packaging' },
    { title: 'Clinical trial data (if applicable) filed', category: 'Regulatory' },
    { title: 'Approved variations documented', category: 'Regulatory' },
    { title: 'Annual product review submitted', category: 'Regulatory' },
    { title: 'Adverse event reports filed', category: 'Pharmacovigilance' },
  ],
  FDA: [
    { title: 'Drug master file (DMF) current', category: 'Regulatory' },
    { title: 'NDA/ANDA application files ready', category: 'Regulatory' },
    { title: 'cGMP compliance verified', category: 'Compliance' },
    { title: '21 CFR Part 11 electronic records compliance', category: 'IT' },
    { title: 'Process validation lifecycle documentation', category: 'Validation' },
    { title: 'Cleaning validation per FDA guidance', category: 'Validation' },
    { title: 'Annual product review (APR) completed', category: 'Quality' },
    { title: 'Adverse event reporting system in place', category: 'Pharmacovigilance' },
    { title: 'FDA inspection readiness checklist done', category: 'Inspection' },
    { title: 'Warning letter responses (if any) addressed', category: 'Regulatory' },
    { title: 'Corrective action follow-up documented', category: 'Quality' },
    { title: 'Labeling compliance with 21 CFR', category: 'Packaging' },
    { title: 'Supplier audit program documented', category: 'Supply Chain' },
    { title: 'Computer system validation complete', category: 'IT' },
  ],
};

@Injectable()
export class AuditReadinessService {
  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
    private storage: StorageService,
  ) {}

  async getReadiness(projectId: string) {
    const project = await this.prisma.companyProject.findUnique({
      where: { id: projectId },
      include: {
        company: { select: { id: true, name: true } },
        auditReadinessItems: {
          include: {
            responsible: { select: { id: true, firstName: true, lastName: true } },
            linkedDocument: { select: { id: true, docName: true, status: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { category: 'asc' }],
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const items = project.auditReadinessItems;
    const total = items.length;
    const done = items.filter(i => i.status === 'APPROVED' || i.status === 'NOT_APPLICABLE').length;
    const readinessPercent = total > 0 ? Math.round((done / total) * 100) : 0;
    const daysToAudit = project.auditDate
      ? differenceInDays(project.auditDate, new Date())
      : null;

    const byCategory = items.reduce<Record<string, typeof items>>((acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    }, {});

    return { project, items, total, done, readinessPercent, daysToAudit, byCategory };
  }

  async createItem(projectId: string, dto: {
    title: string; category: string; responsibleId?: string;
    dueDate?: string; notes?: string; sortOrder?: number;
  }) {
    const project = await this.prisma.companyProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.auditReadinessItem.create({
      data: {
        projectId,
        title: dto.title,
        category: dto.category,
        responsibleId: dto.responsibleId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        sortOrder: dto.sortOrder ?? 0,
        auditType: project.auditType ?? undefined,
      },
    });
  }

  async updateItem(projectId: string, itemId: string, dto: {
    status?: string; notes?: string; responsibleId?: string;
    dueDate?: string; linkedDocumentId?: string; title?: string;
  }) {
    return this.prisma.auditReadinessItem.update({
      where: { id: itemId, projectId },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.responsibleId !== undefined && { responsibleId: dto.responsibleId }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.linkedDocumentId !== undefined && { linkedDocumentId: dto.linkedDocumentId }),
        ...(dto.title && { title: dto.title }),
      },
      include: {
        responsible: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async deleteItem(itemId: string) {
    return this.prisma.auditReadinessItem.delete({ where: { id: itemId } });
  }

  async seedChecklist(projectId: string, auditType: string) {
    const project = await this.prisma.companyProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const type = auditType.toUpperCase();
    const items = CHECKLISTS[type] ?? CHECKLISTS['GMP'] ?? [];

    await this.prisma.companyProject.update({
      where: { id: projectId },
      data: { auditType: type },
    });

    const existing = await this.prisma.auditReadinessItem.count({ where: { projectId } });
    if (existing > 0) {
      return { message: `Checklist already has ${existing} items. Add more manually.`, skipped: true };
    }

    const created = await this.prisma.auditReadinessItem.createMany({
      data: items.map((item, i) => ({
        projectId,
        title: item.title,
        category: item.category,
        auditType: type,
        sortOrder: i,
      })),
    });

    await this.prisma.companyTimelineEntry.create({
      data: {
        companyId: project.companyId,
        entryType: 'AUDIT_PREP',
        title: `${type} audit checklist seeded (${created.count} items)`,
        description: `Default ${type} audit readiness checklist created for project: ${project.name}`,
        referenceId: projectId,
        referenceType: 'CompanyProject',
        entryDate: new Date(),
      },
    });

    return { created: created.count, auditType: type };
  }

  async generateAIGaps(projectId: string) {
    const { project, items, readinessPercent, daysToAudit } = await this.getReadiness(projectId);

    const pendingItems = items.filter(i => i.status === 'PENDING' || i.status === 'IN_PROGRESS');
    if (pendingItems.length === 0) {
      return { analysis: '✓ All items are approved or not applicable. The audit preparation looks complete.' };
    }

    const prompt = `You are an expert pharma regulatory consultant at Nexgen Pharma Solutions.
Analyze this audit readiness checklist and provide concise, actionable recommendations.

Company: ${(project as any).company?.name ?? 'Unknown'}
Audit Type: ${project.auditType ?? 'GMP'}
Readiness: ${readinessPercent}%
Days to Audit: ${daysToAudit !== null ? daysToAudit : 'Not scheduled'}
Total Pending/In-Progress Items: ${pendingItems.length}

Pending/In-Progress Items:
${pendingItems.map((i, n) => `${n + 1}. [${i.status}] ${i.category} → ${i.title}`).join('\n')}

Provide:
1. TOP 3 CRITICAL GAPS (items that could fail the audit if not resolved)
2. RECOMMENDED SEQUENCE (what to tackle first given the timeline)
3. QUICK WINS (items likely resolvable within 2 days)
4. OVERALL RISK ASSESSMENT (one sentence)

Be specific, practical, and concise. No generic advice.`;

    const analysis = await this.gemini.generateText(prompt);

    await this.prisma.aISummary.create({
      data: {
        companyId: (project as any).company?.id,
        summaryType: 'AUDIT_GAP_ANALYSIS',
        content: analysis,
        metadata: { projectId, readinessPercent, pendingCount: pendingItems.length },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return { analysis, readinessPercent, pendingCount: pendingItems.length };
  }

  async exportPdf(projectId: string): Promise<Buffer> {
    const { project, items, readinessPercent, daysToAudit } = await this.getReadiness(projectId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const company = (project as any).company;
      const primaryColor = '#0055ff';
      const dangerColor = '#e63b2e';
      const inkColor = '#1a1a1a';

      // Header
      doc.rect(0, 0, doc.page.width, 60).fill(inkColor);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(14)
        .text('NEXGEN PHARMA SOLUTIONS', 40, 15);
      doc.fontSize(9).font('Helvetica').fillColor('#ffa23a')
        .text('AUDIT READINESS REPORT', 40, 33);
      doc.fillColor('white').fontSize(8)
        .text(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
          doc.page.width - 140, 25);

      doc.fillColor(inkColor).moveDown(2);

      // Company + project info
      doc.font('Helvetica-Bold').fontSize(16).fillColor(inkColor)
        .text(company?.name ?? 'Company', { align: 'center' });
      doc.font('Helvetica').fontSize(11).fillColor('#555')
        .text(`Project: ${project.name}  |  Audit Type: ${project.auditType ?? 'GMP'}  |  Audit Date: ${project.auditDate ? new Date(project.auditDate).toLocaleDateString('en-IN') : 'TBD'}`,
          { align: 'center' });

      doc.moveDown(0.5);

      // Readiness bar
      const barX = 40, barY = doc.y, barW = doc.page.width - 80, barH = 18;
      doc.rect(barX, barY, barW, barH).fillAndStroke('#eee', inkColor);
      const fillW = Math.round(barW * readinessPercent / 100);
      const barColor = readinessPercent >= 80 ? '#0F8F3A' : readinessPercent >= 50 ? '#ffa23a' : dangerColor;
      doc.rect(barX, barY, fillW, barH).fill(barColor);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
        .text(`${readinessPercent}% READY`, barX + fillW / 2 - 25, barY + 4);
      doc.moveDown(1.5);

      // KPI strip
      doc.font('Helvetica-Bold').fontSize(10);
      const kpiY = doc.y;
      [
        { label: 'Total Items', value: String(items.length) },
        { label: 'Approved', value: String(items.filter(i => i.status === 'APPROVED').length) },
        { label: 'Pending', value: String(items.filter(i => i.status === 'PENDING').length) },
        { label: 'In Progress', value: String(items.filter(i => i.status === 'IN_PROGRESS').length) },
        { label: 'Days to Audit', value: daysToAudit !== null ? String(daysToAudit) : '—' },
      ].forEach((k, i) => {
        const x = 40 + i * 102;
        doc.rect(x, kpiY, 95, 36).fillAndStroke('#f5f0e8', inkColor);
        doc.fillColor(inkColor).text(k.value, x + 5, kpiY + 4, { width: 85, align: 'center' });
        doc.font('Helvetica').fontSize(7).fillColor('#888')
          .text(k.label.toUpperCase(), x + 5, kpiY + 21, { width: 85, align: 'center' });
        doc.font('Helvetica-Bold').fontSize(10);
      });
      doc.moveDown(3);

      // Checklist table
      const statusColors: Record<string, string> = {
        APPROVED: '#0F8F3A', IN_PROGRESS: '#0055ff', PENDING: '#888888',
        SUBMITTED: '#ffa23a', NOT_APPLICABLE: '#aaaaaa',
      };

      let currentCategory = '';
      for (const item of items) {
        if (doc.y > doc.page.height - 80) doc.addPage();
        if (item.category !== currentCategory) {
          currentCategory = item.category;
          doc.moveDown(0.3);
          doc.rect(40, doc.y, doc.page.width - 80, 14).fill('#1a1a1a');
          doc.fillColor('white').font('Helvetica-Bold').fontSize(8)
            .text(currentCategory.toUpperCase(), 45, doc.y - 11);
          doc.moveDown(0.4);
        }

        const rowY = doc.y;
        const statusColor = statusColors[item.status] ?? '#888';
        doc.rect(40, rowY, 6, 12).fill(statusColor);
        doc.fillColor(inkColor).font('Helvetica').fontSize(8.5)
          .text(item.title, 52, rowY, { width: 360 });
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(statusColor)
          .text(item.status.replace('_', ' '), 420, rowY + 1, { width: 130, align: 'right' });
        doc.moveDown(0.15);
        doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#ddd').stroke();
        doc.moveDown(0.1);
      }

      // Footer
      doc.fillColor('#888').font('Helvetica').fontSize(7)
        .text(`Generated by NexGen EMS · ${new Date().toISOString()}`, 40,
          doc.page.height - 30, { align: 'center', width: doc.page.width - 80 });

      doc.end();
    });
  }
}
