import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';
import { AIProposalsService } from '../ai-proposals/ai-proposals.service';

@Injectable()
export class WorkUpdatesService {
  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
    private aiProposals: AIProposalsService,
  ) {}

  async create(dto: { rawText: string; updateDate: string; companyId?: string }, employeeId: string) {
    let resolvedCompanyId = dto.companyId ?? null;

    const extracted = await this.gemini.structureWorkUpdate(dto.rawText);

    if (!resolvedCompanyId && extracted.companyName) {
      const found = await this.prisma.clientCompany.findFirst({
        where: { name: { contains: extracted.companyName, mode: 'insensitive' as any } },
      });
      if (found) resolvedCompanyId = found.id;
    }

    const needsAdminReview = String(extracted.needsAdminReview) === 'true' || !resolvedCompanyId;

    const proposal = await this.aiProposals.create({
      proposalType: 'WORK_UPDATE',
      submittedBy: employeeId,
      rawInput: dto.rawText,
      targetEntity: 'WorkUpdate',
      targetEntityId: resolvedCompanyId,
      aiReason: extracted.nextAction ?? extracted.pendingTask ?? null,
      proposedData: {
        employeeId,
        companyId: resolvedCompanyId,
        updateDate: new Date(dto.updateDate).toISOString(),
        extractedData: extracted,
        companyName: extracted.companyName ?? null,
        taskCompleted: extracted.taskCompleted ?? null,
        pendingTask: extracted.pendingTask ?? null,
        progress: extracted.progress ?? null,
        contribution: extracted.contribution ?? null,
        workStatus: extracted.workStatus ?? null,
        nextAction: extracted.nextAction ?? null,
      },
    });

    return { proposal, extracted, needsAdminReview: true, approvalRequired: true };
  }

  async findAll(query: { companyId?: string; employeeId?: string; needsReview?: boolean; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: any = {};
    if (query.companyId) where.companyId = query.companyId;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.needsReview) where.needsAdminReview = true;

    const [items, total] = await Promise.all([
      this.prisma.workUpdate.findMany({
        where,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, designation: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { updateDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.workUpdate.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async review(id: string, reviewedBy: string, status: 'APPROVED' | 'NEEDS_CORRECTION') {
    return this.prisma.workUpdate.update({
      where: { id },
      data: {
        status,
        needsAdminReview: false,
        reviewedBy,
        reviewedAt: new Date(),
      },
    });
  }

  async getMyUpdates(employeeId: string, page = 1, limit = 20) {
    return this.findAll({ employeeId, page, limit });
  }
}
