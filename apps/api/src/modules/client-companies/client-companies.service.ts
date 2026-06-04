import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';
import { CreateClientCompanyDto } from './dto/create-company.dto';
import { UpdateClientCompanyDto } from './dto/update-company.dto';
import { differenceInDays } from 'date-fns';

@Injectable()
export class ClientCompaniesService {
  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
  ) {}

  private computeRiskScore(company: {
    businessStatus: string;
    criticality: string;
    lastVisitDate: Date | null;
    lastCommunicationDate: Date | null;
    nextAuditDate: Date | null;
  }): number {
    let score = 0;
    const now = new Date();

    if (company.businessStatus === 'AT_RISK') score += 30;
    else if (company.businessStatus === 'DORMANT') score += 40;
    else if (company.businessStatus === 'DELAYED') score += 20;
    else if (company.businessStatus === 'LOST') score += 50;

    if (company.criticality === 'HIGH') score += 20;
    else if (company.criticality === 'MEDIUM') score += 10;

    if (company.lastVisitDate) {
      const days = differenceInDays(now, company.lastVisitDate);
      if (days > 45) score += 20;
      else if (days > 30) score += 15;
      else if (days > 15) score += 5;
    } else {
      score += 20;
    }

    if (company.lastCommunicationDate) {
      const days = differenceInDays(now, company.lastCommunicationDate);
      if (days > 30) score += 15;
      else if (days > 15) score += 8;
    } else {
      score += 15;
    }

    if (company.nextAuditDate) {
      const days = differenceInDays(company.nextAuditDate, now);
      if (days <= 7) score += 20;
      else if (days <= 30) score += 10;
    }

    return Math.min(score, 100);
  }

  async create(dto: CreateClientCompanyDto, createdBy: string) {
    const riskScore = this.computeRiskScore({
      businessStatus: dto.businessStatus ?? 'ACTIVE',
      criticality: dto.criticality ?? 'MEDIUM',
      lastVisitDate: dto.lastVisitDate ? new Date(dto.lastVisitDate) : null,
      lastCommunicationDate: dto.lastCommunicationDate ? new Date(dto.lastCommunicationDate) : null,
      nextAuditDate: dto.nextAuditDate ? new Date(dto.nextAuditDate) : null,
    });

    const company = await this.prisma.clientCompany.create({
      data: {
        name: dto.name,
        shortName: dto.shortName,
        industry: dto.industry,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        address: dto.address,
        website: dto.website,
        businessStatus: (dto.businessStatus as any) ?? 'ACTIVE',
        criticality: (dto.criticality as any) ?? 'MEDIUM',
        currentStage: dto.currentStage,
        responsibleEmployeeId: dto.responsibleEmployeeId,
        lastVisitDate: dto.lastVisitDate ? new Date(dto.lastVisitDate) : undefined,
        lastCommunicationDate: dto.lastCommunicationDate ? new Date(dto.lastCommunicationDate) : undefined,
        nextAuditDate: dto.nextAuditDate ? new Date(dto.nextAuditDate) : undefined,
        notes: dto.notes,
        riskScore,
        createdBy,
      },
    });

    await this.prisma.companyTimelineEntry.create({
      data: {
        companyId: company.id,
        entryType: 'STATUS_CHANGE',
        title: 'Company profile created',
        description: `Initial status: ${dto.businessStatus ?? 'ACTIVE'} | Criticality: ${dto.criticality ?? 'MEDIUM'}`,
        employeeId: createdBy,
        entryDate: new Date(),
      },
    });

    return company;
  }

  async findAll(query: {
    status?: string;
    criticality?: string;
    archived?: boolean;
    search?: string;
    responsible?: string;
  }) {
    return this.prisma.clientCompany.findMany({
      where: {
        isArchived: query.archived ?? false,
        ...(query.status && { businessStatus: query.status as any }),
        ...(query.criticality && { criticality: query.criticality as any }),
        ...(query.responsible && { responsibleEmployeeId: query.responsible }),
        ...(query.search && {
          name: { contains: query.search, mode: 'insensitive' as any },
        }),
      },
      include: {
        responsibleEmployee: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { meetingNotes: true, workUpdates: true, visits: true } },
        alerts: { where: { isResolved: false }, select: { id: true, severity: true, alertType: true } },
        projects: { select: { id: true, name: true, status: true, auditDate: true } },
      },
      orderBy: [{ criticality: 'asc' }, { riskScore: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.clientCompany.findUnique({
      where: { id },
      include: {
        responsibleEmployee: { select: { id: true, firstName: true, lastName: true, designation: true } },
        contacts: true,
        projects: {
          include: { leadEmployee: { select: { id: true, firstName: true, lastName: true } } },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { changedByEmployee: { select: { id: true, firstName: true, lastName: true } } },
        },
        visits: {
          orderBy: { visitDate: 'desc' },
          take: 10,
          include: { visitor: { select: { id: true, firstName: true, lastName: true } } },
        },
        alerts: { where: { isResolved: false } },
        aiSummaries: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, dto: UpdateClientCompanyDto, updatedBy: string) {
    const existing = await this.prisma.clientCompany.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Company not found');

    const statusChanged = dto.businessStatus && dto.businessStatus !== existing.businessStatus;
    const criticalityChanged = dto.criticality && dto.criticality !== existing.criticality;

    const riskScore = this.computeRiskScore({
      businessStatus: dto.businessStatus ?? existing.businessStatus,
      criticality: dto.criticality ?? existing.criticality,
      lastVisitDate: dto.lastVisitDate ? new Date(dto.lastVisitDate) : existing.lastVisitDate,
      lastCommunicationDate: dto.lastCommunicationDate ? new Date(dto.lastCommunicationDate) : existing.lastCommunicationDate,
      nextAuditDate: dto.nextAuditDate ? new Date(dto.nextAuditDate) : existing.nextAuditDate,
    });

    const updated = await this.prisma.clientCompany.update({
      where: { id },
      data: {
        ...dto,
        businessStatus: dto.businessStatus as any,
        criticality: dto.criticality as any,
        lastVisitDate: dto.lastVisitDate ? new Date(dto.lastVisitDate) : undefined,
        lastCommunicationDate: dto.lastCommunicationDate ? new Date(dto.lastCommunicationDate) : undefined,
        nextAuditDate: dto.nextAuditDate ? new Date(dto.nextAuditDate) : undefined,
        riskScore,
      },
    });

    if (statusChanged || criticalityChanged) {
      await this.prisma.companyStatusHistory.create({
        data: {
          companyId: id,
          businessStatus: (dto.businessStatus ?? existing.businessStatus) as any,
          criticality: (dto.criticality ?? existing.criticality) as any,
          riskScore,
          summary: `Status changed from ${existing.businessStatus} to ${dto.businessStatus ?? existing.businessStatus}`,
          changedBy: updatedBy,
        },
      });

      await this.prisma.companyTimelineEntry.create({
        data: {
          companyId: id,
          entryType: 'STATUS_CHANGE',
          title: `Status updated: ${dto.businessStatus ?? existing.businessStatus}`,
          description: `Criticality: ${dto.criticality ?? existing.criticality} | Risk Score: ${riskScore}`,
          employeeId: updatedBy,
          entryDate: new Date(),
        },
      });
    }

    return updated;
  }

  async generateAISummary(id: string) {
    const company = await this.findOne(id);

    const recentUpdates = await this.prisma.workUpdate.findMany({
      where: { companyId: id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { rawText: true },
    });

    const pendingTasks = await this.prisma.meetingNote.findMany({
      where: { companyId: id, adminReviewedBy: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { pendingGap: true },
    });

    const now = new Date();
    const summaryText = await this.gemini.generateCompanySummary({
      name: company.name,
      businessStatus: company.businessStatus,
      criticality: company.criticality,
      lastVisitDate: company.lastVisitDate?.toISOString().split('T')[0] ?? null,
      lastCommunicationDate: company.lastCommunicationDate?.toISOString().split('T')[0] ?? null,
      nextAuditDate: company.nextAuditDate?.toISOString().split('T')[0] ?? null,
      recentUpdates: recentUpdates.map(u => u.rawText),
      pendingTasks: pendingTasks.map(t => t.pendingGap ?? '').filter(Boolean),
      riskScore: company.riskScore,
    });

    const nextAction = await this.gemini.generateNextAction({
      name: company.name,
      businessStatus: company.businessStatus,
      criticality: company.criticality,
      daysSinceVisit: company.lastVisitDate ? differenceInDays(now, company.lastVisitDate) : null,
      daysSinceCommunication: company.lastCommunicationDate ? differenceInDays(now, company.lastCommunicationDate) : null,
      nextAuditDate: company.nextAuditDate?.toISOString().split('T')[0] ?? null,
      pendingTasks: pendingTasks.map(t => t.pendingGap ?? '').filter(Boolean),
    });

    const saved = await this.prisma.aISummary.create({
      data: {
        companyId: id,
        summaryType: 'COMPANY_OVERVIEW',
        content: summaryText,
        metadata: { nextAction },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.prisma.companyTimelineEntry.create({
      data: {
        companyId: id,
        entryType: 'AI_SUMMARY',
        title: 'AI summary generated',
        description: summaryText.substring(0, 200),
        referenceId: saved.id,
        referenceType: 'AISummary',
        entryDate: new Date(),
      },
    });

    return { summary: summaryText, nextAction };
  }

  async getTimeline(id: string, limit = 50) {
    const company = await this.prisma.clientCompany.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    return this.prisma.companyTimelineEntry.findMany({
      where: { companyId: id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { entryDate: 'desc' },
      take: limit,
    });
  }

  async runAlertCheck() {
    const alertMild = 7;
    const alertModerate = 15;
    const alertCritical = 30;
    const alertVisit = 45;
    const now = new Date();

    const companies = await this.prisma.clientCompany.findMany({
      where: { isArchived: false, businessStatus: { not: 'LOST' } },
    });

    for (const c of companies) {
      const daysSinceVisit = c.lastVisitDate ? differenceInDays(now, c.lastVisitDate) : null;
      const daysSinceComm = c.lastCommunicationDate ? differenceInDays(now, c.lastCommunicationDate) : null;

      const existingAlerts = await this.prisma.companyAlert.findMany({
        where: { companyId: c.id, isResolved: false },
        select: { alertType: true },
      });
      const existingTypes = new Set(existingAlerts.map(a => a.alertType));

      if (daysSinceVisit !== null && daysSinceVisit >= alertVisit && !existingTypes.has('NO_VISIT_45')) {
        await this.prisma.companyAlert.create({
          data: {
            companyId: c.id,
            severity: 'CRITICAL',
            alertType: 'NO_VISIT_45',
            message: `No visit recorded for ${daysSinceVisit} days. Visit planning required.`,
          },
        });
      } else if (daysSinceVisit !== null && daysSinceVisit >= alertCritical && !existingTypes.has('NO_VISIT_30')) {
        await this.prisma.companyAlert.create({
          data: {
            companyId: c.id,
            severity: 'CRITICAL',
            alertType: 'NO_VISIT_30',
            message: `No visit for ${daysSinceVisit} days. Management attention required.`,
          },
        });
      }

      if (daysSinceComm !== null && daysSinceComm >= alertCritical && !existingTypes.has('NO_COMM_30')) {
        await this.prisma.companyAlert.create({
          data: {
            companyId: c.id,
            severity: 'CRITICAL',
            alertType: 'NO_COMM_30',
            message: `No communication for ${daysSinceComm} days. Company marked as Dormant risk.`,
          },
        });

        if (c.businessStatus === 'ACTIVE') {
          await this.prisma.clientCompany.update({
            where: { id: c.id },
            data: { businessStatus: 'DORMANT' },
          });
        }
      } else if (daysSinceComm !== null && daysSinceComm >= alertModerate && !existingTypes.has('NO_COMM_15')) {
        await this.prisma.companyAlert.create({
          data: {
            companyId: c.id,
            severity: 'MODERATE',
            alertType: 'NO_COMM_15',
            message: `No communication for ${daysSinceComm} days. Follow-up required.`,
          },
        });
      } else if (daysSinceComm !== null && daysSinceComm >= alertMild && !existingTypes.has('NO_COMM_7')) {
        await this.prisma.companyAlert.create({
          data: {
            companyId: c.id,
            severity: 'MILD',
            alertType: 'NO_COMM_7',
            message: `No communication for ${daysSinceComm} days. Mild reminder.`,
          },
        });
      }

      if (c.nextAuditDate) {
        const daysToAudit = differenceInDays(c.nextAuditDate, now);
        if (daysToAudit <= 7 && daysToAudit >= 0 && !existingTypes.has('AUDIT_7')) {
          await this.prisma.companyAlert.create({
            data: {
              companyId: c.id,
              severity: 'CRITICAL',
              alertType: 'AUDIT_7',
              message: `Audit in ${daysToAudit} days! Immediate preparation needed.`,
            },
          });
        } else if (daysToAudit <= 30 && daysToAudit >= 0 && !existingTypes.has('AUDIT_30')) {
          await this.prisma.companyAlert.create({
            data: {
              companyId: c.id,
              severity: 'MODERATE',
              alertType: 'AUDIT_30',
              message: `Audit in ${daysToAudit} days. Ensure preparation is on track.`,
            },
          });
        }
      }
    }
  }

  async addVisit(companyId: string, dto: { visitDate: string; purpose?: string; outcome?: string; nextSteps?: string; followUpDate?: string }, visitedBy: string) {
    const company = await this.prisma.clientCompany.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const visit = await this.prisma.companyVisit.create({
      data: {
        companyId,
        visitedBy,
        visitDate: new Date(dto.visitDate),
        purpose: dto.purpose,
        outcome: dto.outcome,
        nextSteps: dto.nextSteps,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
      },
    });

    await this.prisma.clientCompany.update({
      where: { id: companyId },
      data: {
        lastVisitDate: new Date(dto.visitDate),
        lastCommunicationDate: new Date(dto.visitDate),
      },
    });

    await this.prisma.companyTimelineEntry.create({
      data: {
        companyId,
        entryType: 'VISIT',
        title: `Visit recorded`,
        description: dto.outcome ?? dto.purpose ?? 'Visit recorded',
        employeeId: visitedBy,
        referenceId: visit.id,
        referenceType: 'CompanyVisit',
        entryDate: new Date(dto.visitDate),
      },
    });

    await this.prisma.companyAlert.updateMany({
      where: { companyId, isResolved: false, alertType: { in: ['NO_VISIT_45', 'NO_VISIT_30'] } },
      data: { isResolved: true, resolvedAt: new Date(), resolvedBy: visitedBy },
    });

    return visit;
  }
}
