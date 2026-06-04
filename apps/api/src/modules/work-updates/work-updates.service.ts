import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';

@Injectable()
export class WorkUpdatesService {
  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
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

    const update = await this.prisma.workUpdate.create({
      data: {
        employeeId,
        companyId: resolvedCompanyId,
        rawText: dto.rawText,
        updateDate: new Date(dto.updateDate),
        extractedData: extracted as any,
        companyName: extracted.companyName ?? null,
        taskCompleted: extracted.taskCompleted ?? null,
        pendingTask: extracted.pendingTask ?? null,
        progress: extracted.progress ?? null,
        contribution: extracted.contribution ?? null,
        workStatus: extracted.workStatus ?? null,
        nextAction: extracted.nextAction ?? null,
        needsAdminReview,
      },
    });

    if (resolvedCompanyId) {
      await this.prisma.companyTimelineEntry.create({
        data: {
          companyId: resolvedCompanyId,
          entryType: 'EMPLOYEE_UPDATE',
          title: `Work update: ${extracted.taskCompleted?.substring(0, 60) ?? dto.rawText.substring(0, 60)}`,
          description: extracted.pendingTask ?? extracted.workStatus ?? '',
          employeeId,
          referenceId: update.id,
          referenceType: 'WorkUpdate',
          entryDate: new Date(dto.updateDate),
        },
      });

      await this.prisma.clientCompany.update({
        where: { id: resolvedCompanyId },
        data: { lastCommunicationDate: new Date(dto.updateDate) },
      });
    }

    return { update, extracted, needsAdminReview };
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
