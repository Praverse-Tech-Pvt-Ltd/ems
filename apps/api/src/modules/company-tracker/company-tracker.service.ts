import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

type UserCtx = { id: string; role: string };
type Query = Record<string, string | undefined>;

const CLOSED_STATUSES = new Set(['Completed', 'Closed']);
const ACTIVE_STATUSES = new Set(['Not Started', 'Data Awaited', 'Under Review', 'Query Raised', 'In Progress', 'Sent to Client', 'Client Feedback Awaited', 'Revised', 'On Hold', 'Delayed']);

const OPTIONS = {
  clientTypes: ['API Manufacturer', 'Formulation Manufacturer', 'Excipient Manufacturer', 'Consultancy Client', 'Audit Client', 'Other'],
  projectTypes: ['WHO-GMP Readiness', 'USFDA Readiness', 'EDQM Compliance', 'SOP Review', 'SOP Implementation', 'QMS Implementation', 'Qualification Documentation', 'Validation Documentation', 'BMR Review', 'Analytical Data Review', 'Gap Assessment', 'Audit Agenda Preparation', 'Technical Document Review', 'CAPA / Remediation', 'Other'],
  regulatoryGoals: ['WHO', 'USFDA', 'EDQM', 'EU GMP', 'Indian GMP', 'Customer Audit', 'Internal Readiness', 'Other'],
  stages: ['Not Started', 'Data Awaited', 'Under Review', 'Query Raised', 'In Progress', 'Sent to Client', 'Client Feedback Awaited', 'Revised', 'Completed', 'On Hold', 'Delayed', 'Closed'],
  priorities: ['Critical', 'High', 'Medium', 'Low'],
  requirementCategories: ['Audit Agenda', 'Basic Documents', 'SOP', 'Qualification Document', 'Validation Document', 'Analytical Data Sheet', 'BMR Review', 'Gap Assessment', 'CAPA Plan', 'Risk Assessment', 'Follow-up Document', 'Training Document', 'Regulatory Response', 'Other'],
  requirementStatuses: ['Not Started', 'In Progress', 'Submitted for Review', 'Review Comments Received', 'Correction Required', 'Completed', 'Sent to Client', 'Client Feedback Awaited', 'Closed', 'Delayed'],
  documentTypes: ['Audit Agenda', 'SOP', 'Qualification Document', 'Validation Document', 'BMR', 'Analytical Data Sheet', 'Gap Assessment', 'CAPA', 'Risk Assessment', 'Regulatory Response', 'Client Communication', 'Other'],
};

@Injectable()
export class CompanyTrackerService {
  constructor(private prisma: PrismaService) {}

  options() {
    return OPTIONS;
  }

  private isAdmin(user: UserCtx) {
    return ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  }

  private today() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private parseDate(value?: unknown) {
    if (!value || typeof value !== 'string') return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private daysBetween(a?: Date | null, b = this.today()) {
    if (!a) return 0;
    const left = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())).getTime();
    const right = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())).getTime();
    return Math.max(0, Math.floor((right - left) / 86400000));
  }

  private projectWhere(user: UserCtx, query: Query = {}) {
    const where: Record<string, unknown> = {};
    if (!this.isAdmin(user)) {
      where['OR'] = [
        { ownerId: user.id },
        { assignments: { some: { employeeId: user.id } } },
        { requirements: { some: { assignedTo: user.id } } },
      ];
    }
    if (query.companyId) where['companyId'] = query.companyId;
    if (query.goal) where['regulatoryGoal'] = query.goal;
    if (query.projectType) where['projectType'] = query.projectType;
    if (query.status) where['currentStage'] = query.status;
    if (query.priority) where['priority'] = query.priority;
    if (query.search) where['company'] = { name: { contains: query.search, mode: 'insensitive' } };
    return where;
  }

  private includeProject() {
    return {
      company: { select: { id: true, name: true, shortName: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      assignments: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } },
      requirements: {
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          reviewer: { select: { id: true, firstName: true, lastName: true } },
          documents: true,
        },
        orderBy: [{ dueDate: 'asc' as const }, { createdAt: 'asc' as const }],
      },
      followUps: { include: { responsible: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { nextFollowUpDate: 'asc' as const } },
    };
  }

  private decorateProject(project: any) {
    const today = this.today();
    const requirements = project.requirements ?? [];
    const completed = requirements.filter((r: any) => CLOSED_STATUSES.has(r.status)).length;
    const completionPercent = requirements.length ? Math.round((completed / requirements.length) * 100) : 0;
    const delayedRequirements = requirements.filter((r: any) => r.dueDate && r.dueDate < today && !CLOSED_STATUSES.has(r.status));
    const noRecentUpdate = requirements.filter((r: any) => ACTIVE_STATUSES.has(r.status) && this.daysBetween(r.lastUpdatedAt) > 3);
    const pendingFinalClosure = requirements.filter((r: any) => r.completionPercent >= 100 && r.status !== 'Closed');
    const delayDays = project.targetCompletionDate && project.targetCompletionDate < today && !CLOSED_STATUSES.has(project.currentStage)
      ? this.daysBetween(project.targetCompletionDate)
      : 0;
    const todayFollowUps = (project.followUps ?? []).filter((f: any) => f.nextFollowUpDate?.getTime() === today.getTime() && !CLOSED_STATUSES.has(f.status));
    const overdueFollowUps = (project.followUps ?? []).filter((f: any) => f.nextFollowUpDate && f.nextFollowUpDate < today && !CLOSED_STATUSES.has(f.status));

    return {
      ...project,
      completionPercent,
      completedRequirements: completed,
      totalRequirements: requirements.length,
      delayedRequirements,
      noRecentUpdate,
      pendingFinalClosure,
      delayDays,
      todayFollowUps,
      overdueFollowUps,
      isAtRisk: delayedRequirements.some((r: any) => ['Critical', 'High'].includes(project.priority)) || delayDays > 0,
    };
  }

  async listProjects(user: UserCtx, query: Query = {}) {
    const projects = await this.prisma.companyTrackerProject.findMany({
      where: this.projectWhere(user, query),
      include: this.includeProject(),
      orderBy: [{ priority: 'asc' }, { targetCompletionDate: 'asc' }, { updatedAt: 'desc' }],
    });
    return projects.map((project) => this.decorateProject(project));
  }

  async getProject(user: UserCtx, id: string) {
    const project = await this.prisma.companyTrackerProject.findUnique({
      where: { id },
      include: {
        ...this.includeProject(),
        documents: { include: { uploader: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { uploadedAt: 'desc' } },
        activityLogs: { include: { actor: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });
    if (!project) throw new NotFoundException('Tracker project not found');
    if (!this.isAdmin(user) && project.ownerId !== user.id && !project.assignments.some((a: any) => a.employeeId === user.id) && !project.requirements.some((r: any) => r.assignedTo === user.id)) {
      throw new ForbiddenException('You can only view assigned tracker work');
    }
    return this.decorateProject(project);
  }

  async dashboard(user: UserCtx, query: Query = {}) {
    const projects = await this.listProjects(user, query);
    const today = this.today();
    const weekEnd = new Date(today);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const requirements = projects.flatMap((p: any) => (p.requirements ?? []).map((r: any) => ({ ...r, project: p })));
    const followUps = projects.flatMap((p: any) => (p.followUps ?? []).map((f: any) => ({ ...f, project: p })));
    const delayed = requirements.filter((r: any) => r.dueDate && r.dueDate < today && !CLOSED_STATUSES.has(r.status));
    const dueThisWeek = requirements.filter((r: any) => r.dueDate && r.dueDate >= today && r.dueDate <= weekEnd && !CLOSED_STATUSES.has(r.status));
    const todayFollowUps = followUps.filter((f: any) => f.nextFollowUpDate?.getTime() === today.getTime() && !CLOSED_STATUSES.has(f.status));
    const overdueFollowUps = followUps.filter((f: any) => f.nextFollowUpDate && f.nextFollowUpDate < today && !CLOSED_STATUSES.has(f.status));
    const employeeMap = new Map<string, any>();
    requirements.forEach((r: any) => {
      if (!r.assignee) return;
      const key = r.assignee.id;
      const row = employeeMap.get(key) ?? { employee: r.assignee, assignedCompanies: new Set(), totalTasks: 0, pendingTasks: 0, completedTasks: 0, delayedTasks: 0, dueThisWeek: 0 };
      row.assignedCompanies.add(r.project.company.name);
      row.totalTasks += 1;
      if (CLOSED_STATUSES.has(r.status)) row.completedTasks += 1;
      else row.pendingTasks += 1;
      if (delayed.some((d: any) => d.id === r.id)) row.delayedTasks += 1;
      if (dueThisWeek.some((d: any) => d.id === r.id)) row.dueThisWeek += 1;
      employeeMap.set(key, row);
    });

    return {
      role: this.isAdmin(user) ? 'management' : 'employee',
      cards: {
        totalActiveCompanies: new Set(projects.filter((p: any) => p.currentStage !== 'Closed').map((p: any) => p.companyId)).size,
        totalProjects: projects.length,
        projectsCompleted: projects.filter((p: any) => CLOSED_STATUSES.has(p.currentStage)).length,
        projectsDelayed: projects.filter((p: any) => p.delayDays > 0 || p.delayedRequirements.length > 0).length,
        projectsDueThisWeek: projects.filter((p: any) => p.targetCompletionDate && p.targetCompletionDate >= today && p.targetCompletionDate <= weekEnd).length,
        todayFollowUps: todayFollowUps.length,
        overdueFollowUps: overdueFollowUps.length,
        criticalPriorityProjects: projects.filter((p: any) => ['Critical', 'High'].includes(p.priority)).length,
        pendingTasks: requirements.filter((r: any) => !CLOSED_STATUSES.has(r.status)).length,
        completedTasks: requirements.filter((r: any) => CLOSED_STATUSES.has(r.status)).length,
        delayedTasks: delayed.length,
      },
      companyProgress: projects,
      employeeWorkload: Array.from(employeeMap.values()).map((row: any) => ({ ...row, assignedCompanies: row.assignedCompanies.size })),
      escalations: delayed.filter((r: any) => ['Critical', 'High'].includes(r.project.priority)).map((r: any) => ({ ...r, delayDays: this.daysBetween(r.dueDate) })),
      followUps,
      todayFollowUps,
      overdueFollowUps,
      dueThisWeek,
      pendingFinalClosure: requirements.filter((r: any) => r.completionPercent >= 100 && r.status !== 'Closed'),
      noRecentUpdate: requirements.filter((r: any) => ACTIVE_STATUSES.has(r.status) && this.daysBetween(r.lastUpdatedAt) > 3),
    };
  }

  async createProject(user: UserCtx, dto: Record<string, any>) {
    const trackingId = dto.trackingId || `TRK-${Date.now().toString(36).toUpperCase()}`;
    const project = await this.prisma.companyTrackerProject.create({
      data: {
        trackingId,
        companyId: String(dto.companyId),
        clientType: String(dto.clientType ?? 'Other'),
        projectType: String(dto.projectType ?? 'Other'),
        regulatoryGoal: String(dto.regulatoryGoal ?? 'Other'),
        currentStage: String(dto.currentStage ?? 'Not Started'),
        priority: String(dto.priority ?? 'Medium'),
        ownerId: dto.ownerId || user.id,
        startDate: this.parseDate(dto.startDate),
        targetCompletionDate: this.parseDate(dto.targetCompletionDate),
        revisedTargetDate: this.parseDate(dto.revisedTargetDate),
        currentStatusSummary: dto.currentStatusSummary,
        lastFollowUpDate: this.parseDate(dto.lastFollowUpDate),
        nextFollowUpDate: this.parseDate(dto.nextFollowUpDate),
        delayReason: dto.delayReason,
        internalRemarks: dto.internalRemarks,
        clientRemarks: dto.clientRemarks,
        createdBy: user.id,
        assignments: dto.assignedEmployeeIds?.length ? { create: dto.assignedEmployeeIds.map((employeeId: string) => ({ employeeId, role: 'Assigned Employee' })) } : undefined,
      },
      include: this.includeProject(),
    });
    await this.log(user.id, 'PROJECT_CREATED', { projectId: project.id, companyId: project.companyId, newValue: project });
    await this.notifyMany(dto.assignedEmployeeIds ?? [], 'New company tracker assignment', `${project.company?.name ?? 'Company'}: ${project.projectType}`, project.id, 'company-tracker');
    return this.decorateProject(project);
  }

  async updateProject(user: UserCtx, id: string, dto: Record<string, any>) {
    const existing = await this.getProject(user, id);
    const updated = await this.prisma.companyTrackerProject.update({
      where: { id },
      data: {
        clientType: dto.clientType,
        projectType: dto.projectType,
        regulatoryGoal: dto.regulatoryGoal,
        currentStage: dto.currentStage,
        priority: dto.priority,
        ownerId: dto.ownerId,
        startDate: this.parseDate(dto.startDate),
        targetCompletionDate: this.parseDate(dto.targetCompletionDate),
        revisedTargetDate: this.parseDate(dto.revisedTargetDate),
        actualCompletionDate: this.parseDate(dto.actualCompletionDate),
        currentStatusSummary: dto.currentStatusSummary,
        lastFollowUpDate: this.parseDate(dto.lastFollowUpDate),
        nextFollowUpDate: this.parseDate(dto.nextFollowUpDate),
        delayReason: dto.delayReason,
        internalRemarks: dto.internalRemarks,
        clientRemarks: dto.clientRemarks,
        updatedBy: user.id,
        assignments: Array.isArray(dto.assignedEmployeeIds) ? { deleteMany: {}, create: dto.assignedEmployeeIds.map((employeeId: string) => ({ employeeId, role: 'Assigned Employee' })) } : undefined,
      },
      include: this.includeProject(),
    });
    await this.log(user.id, 'PROJECT_UPDATED', { projectId: id, companyId: updated.companyId, oldValue: existing, newValue: updated, remarks: dto.remarks });
    return this.decorateProject(updated);
  }

  async deleteProject(user: UserCtx, id: string) {
    const existing = await this.getProject(user, id);
    await this.prisma.companyTrackerProject.delete({ where: { id } });
    await this.log(user.id, 'PROJECT_DELETED', { companyId: existing.companyId, oldValue: existing });
    return { ok: true };
  }

  async addRequirement(user: UserCtx, projectId: string, dto: Record<string, any>) {
    const project = await this.getProject(user, projectId);
    const requirement = await this.prisma.projectRequirement.create({
      data: {
        requirementCode: dto.requirementCode || `REQ-${Date.now().toString(36).toUpperCase()}`,
        trackerProjectId: projectId,
        category: String(dto.category ?? 'Other'),
        description: String(dto.description),
        expectedOutput: dto.expectedOutput,
        assignedTo: dto.assignedTo,
        reviewerId: dto.reviewerId,
        dueDate: this.parseDate(dto.dueDate),
        status: String(dto.status ?? 'Not Started'),
        completionPercent: Number(dto.completionPercent ?? 0),
        documentRequired: Boolean(dto.documentRequired),
        documentUploaded: Boolean(dto.documentUploaded),
        remarks: dto.remarks,
        lastUpdatedBy: user.id,
      },
    });
    await this.log(user.id, 'REQUIREMENT_CREATED', { projectId, companyId: project.companyId, requirementId: requirement.id, newValue: requirement });
    if (dto.assignedTo) await this.notifyMany([dto.assignedTo], 'New task assigned', `${project.company.name}: ${requirement.description}`, requirement.id, 'project-requirement');
    return requirement;
  }

  async updateRequirement(user: UserCtx, id: string, dto: Record<string, any>) {
    const existing = await this.prisma.projectRequirement.findUnique({ where: { id }, include: { trackerProject: { include: { assignments: true, company: true } } } });
    if (!existing) throw new NotFoundException('Requirement not found');
    const canUpdate = this.isAdmin(user) || existing.assignedTo === user.id || existing.reviewerId === user.id || existing.trackerProject.assignments.some((a: any) => a.employeeId === user.id);
    if (!canUpdate) throw new ForbiddenException('You can only update assigned requirements');
    if (!this.isAdmin(user) && ('reviewComments' in dto || dto.status === 'Closed')) throw new ForbiddenException('Only admin/reviewer can close or add review comments');
    const updated = await this.prisma.projectRequirement.update({
      where: { id },
      data: {
        category: dto.category,
        description: dto.description,
        expectedOutput: dto.expectedOutput,
        assignedTo: this.isAdmin(user) ? dto.assignedTo : undefined,
        reviewerId: this.isAdmin(user) ? dto.reviewerId : undefined,
        dueDate: this.isAdmin(user) ? this.parseDate(dto.dueDate) : undefined,
        status: dto.status,
        completionPercent: dto.completionPercent == null ? undefined : Number(dto.completionPercent),
        documentRequired: dto.documentRequired,
        documentUploaded: dto.documentUploaded,
        remarks: dto.remarks,
        reviewComments: this.isAdmin(user) ? dto.reviewComments : undefined,
        delayReason: dto.delayReason,
        lastUpdatedBy: user.id,
      },
    });
    await this.log(user.id, 'REQUIREMENT_UPDATED', { projectId: existing.trackerProjectId, companyId: existing.trackerProject.companyId, requirementId: id, oldValue: existing, newValue: updated, remarks: dto.remarks });
    if (updated.status === 'Submitted for Review') {
      const admins = await this.prisma.employee.findMany({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] as any }, status: 'ACTIVE' as any }, select: { id: true } });
      await this.notifyMany(admins.map((a) => a.id), 'Task submitted for review', `${existing.trackerProject.company.name}: ${updated.description}`, updated.id, 'project-requirement');
    }
    return updated;
  }

  async addDocument(user: UserCtx, requirementId: string, dto: Record<string, any>) {
    const requirement = await this.prisma.projectRequirement.findUnique({ where: { id: requirementId }, include: { trackerProject: true } });
    if (!requirement) throw new NotFoundException('Requirement not found');
    const document = await this.prisma.trackerDocument.create({
      data: {
        companyId: requirement.trackerProject.companyId,
        trackerProjectId: requirement.trackerProjectId,
        requirementId,
        title: String(dto.title),
        documentType: String(dto.documentType ?? 'Other'),
        versionNo: dto.versionNo,
        remarks: dto.remarks,
        fileLink: dto.fileLink,
        uploadedBy: user.id,
      },
    });
    await this.prisma.projectRequirement.update({ where: { id: requirementId }, data: { documentUploaded: true, lastUpdatedBy: user.id } });
    await this.log(user.id, 'DOCUMENT_UPLOADED', { projectId: requirement.trackerProjectId, companyId: requirement.trackerProject.companyId, requirementId, newValue: document, fileReference: document.fileLink ?? undefined });
    return document;
  }

  async createFollowUp(user: UserCtx, dto: Record<string, any>) {
    const followUp = await this.prisma.trackerFollowUp.create({
      data: {
        companyId: String(dto.companyId),
        trackerProjectId: dto.trackerProjectId,
        requirementId: dto.requirementId,
        description: String(dto.description),
        responsibleId: dto.responsibleId,
        lastFollowUpDate: this.parseDate(dto.lastFollowUpDate),
        nextFollowUpDate: this.parseDate(dto.nextFollowUpDate),
        status: String(dto.status ?? 'Open'),
        remarks: dto.remarks,
      },
    });
    await this.log(user.id, 'FOLLOW_UP_CREATED', { projectId: followUp.trackerProjectId ?? undefined, companyId: followUp.companyId, requirementId: followUp.requirementId ?? undefined, newValue: followUp });
    if (followUp.responsibleId) await this.notifyMany([followUp.responsibleId], 'Follow-up assigned', followUp.description, followUp.id, 'tracker-follow-up');
    return followUp;
  }

  async updateFollowUp(user: UserCtx, id: string, dto: Record<string, any>) {
    const existing = await this.prisma.trackerFollowUp.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Follow-up not found');
    if (!this.isAdmin(user) && existing.responsibleId !== user.id) throw new ForbiddenException('You can only update assigned follow-ups');
    const status = dto.status ?? existing.status;
    const updated = await this.prisma.trackerFollowUp.update({
      where: { id },
      data: {
        description: dto.description,
        responsibleId: this.isAdmin(user) ? dto.responsibleId : undefined,
        lastFollowUpDate: this.parseDate(dto.lastFollowUpDate),
        nextFollowUpDate: this.parseDate(dto.nextFollowUpDate),
        status,
        remarks: dto.remarks,
        completedAt: CLOSED_STATUSES.has(status) ? new Date() : undefined,
      },
    });
    await this.log(user.id, 'FOLLOW_UP_UPDATED', { projectId: existing.trackerProjectId ?? undefined, companyId: existing.companyId, requirementId: existing.requirementId ?? undefined, oldValue: existing, newValue: updated, remarks: dto.remarks });
    return updated;
  }

  async exportReport(user: UserCtx, type: string, query: Query = {}) {
    const dashboard = await this.dashboard(user, query);
    const rows = type === 'employee-pending'
      ? dashboard.employeeWorkload
      : type === 'delayed'
        ? dashboard.escalations
        : type === 'follow-ups'
          ? dashboard.followUps
          : dashboard.companyProgress;
    return { filename: `company-tracker-${type}.csv`, csv: this.toCsv(rows) };
  }

  private toCsv(rows: any[]) {
    const flat: Record<string, unknown>[] = rows.map((row) => ({
      company: row.company?.name ?? row.project?.company?.name ?? row.employee?.firstName ?? '',
      projectType: row.projectType ?? row.project?.projectType ?? '',
      regulatoryGoal: row.regulatoryGoal ?? row.project?.regulatoryGoal ?? '',
      requirement: row.description ?? '',
      status: row.status ?? row.currentStage ?? '',
      priority: row.priority ?? row.project?.priority ?? '',
      dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : '',
      targetDate: row.targetCompletionDate ? row.targetCompletionDate.toISOString().slice(0, 10) : '',
      completion: row.completionPercent ?? '',
      remarks: row.remarks ?? row.currentStatusSummary ?? '',
    }));
    const headers = Object.keys(flat[0] ?? { company: '', projectType: '', regulatoryGoal: '', status: '' });
    return [headers.join(','), ...flat.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  }

  private async log(actorId: string, action: string, data: { companyId?: string; projectId?: string; requirementId?: string; oldValue?: unknown; newValue?: unknown; remarks?: string; fileReference?: string }) {
    await this.prisma.trackerActivityLog.create({
      data: {
        actorId,
        action,
        companyId: data.companyId,
        trackerProjectId: data.projectId,
        requirementId: data.requirementId,
        oldValue: data.oldValue as any,
        newValue: data.newValue as any,
        remarks: data.remarks,
        fileReference: data.fileReference,
      },
    });
  }

  private async notifyMany(employeeIds: string[], title: string, body: string, referenceId: string, referenceType: string) {
    const unique = [...new Set(employeeIds.filter(Boolean))];
    if (!unique.length) return;
    await this.prisma.notification.createMany({
      data: unique.map((employeeId) => ({
        employeeId,
        type: 'GENERAL' as any,
        title,
        body,
        referenceId,
        referenceType,
      })),
    });
  }
}
