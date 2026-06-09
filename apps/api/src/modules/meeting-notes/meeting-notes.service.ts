import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { GeminiService } from '../ai-overview/gemini.service';
import { ConfigService } from '@nestjs/config';
import { AIProposalsService } from '../ai-proposals/ai-proposals.service';

@Injectable()
export class MeetingNotesService {
  private ownerIds: string[];

  constructor(
    private prisma: PrismaService,
    private gemini: GeminiService,
    private config: ConfigService,
    private aiProposals: AIProposalsService,
  ) {
    const raw = this.config.get<string>('OWNER_EMPLOYEE_IDS', '');
    this.ownerIds = raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  private isOwnerOrAdmin(employeeId: string, role: string): boolean {
    return this.ownerIds.includes(employeeId) || ['ADMIN', 'SUPER_ADMIN'].includes(role);
  }

  async create(dto: { rawText: string; meetingDate: string; companyId?: string }, enteredBy: string) {
    const extracted = await this.gemini.extractMeetingNote(dto.rawText);

    let resolvedCompanyId = dto.companyId ?? null;
    if (!resolvedCompanyId && extracted.companyName) {
      const found = await this.prisma.clientCompany.findFirst({
        where: { name: { contains: extracted.companyName, mode: 'insensitive' as any } },
      });
      if (found) resolvedCompanyId = found.id;
    }

    const needsAdminReview = !resolvedCompanyId || !extracted.assignedTo;

    const proposal = await this.aiProposals.create({
      proposalType: 'MEETING_NOTE',
      submittedBy: enteredBy,
      rawInput: dto.rawText,
      targetEntity: 'MeetingNote',
      targetEntityId: resolvedCompanyId,
      aiReason: extracted.followUpAction ?? extracted.pendingGap ?? null,
      proposedData: {
        rawText: dto.rawText,
        meetingDate: new Date(dto.meetingDate).toISOString(),
        companyId: resolvedCompanyId,
        enteredBy,
        extractedData: extracted,
        companyName: extracted.companyName ?? null,
        employeeName: extracted.employeeName ?? null,
        workDiscussed: extracted.workDiscussed ?? null,
        assignedTo: extracted.assignedTo ?? null,
        deadline: extracted.deadline ? new Date(extracted.deadline).toISOString() : null,
        currentStatus: extracted.currentStatus ?? null,
        pendingGap: extracted.pendingGap ?? null,
        followUpAction: extracted.followUpAction ?? null,
        priorityLevel: extracted.priorityLevel ?? null,
        ownerNote: extracted.ownerNote ?? null,
      },
    });

    return { proposal, extracted, needsAdminReview: true, approvalRequired: true };
  }

  async findAll(query: { companyId?: string; needsReview?: boolean; page?: number; limit?: number }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.companyId) where.companyId = query.companyId;
    if (query.needsReview) where.needsAdminReview = true;

    const [items, total] = await Promise.all([
      this.prisma.meetingNote.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          enteredByEmployee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { meetingDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.meetingNote.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async adminReview(id: string, reviewedBy: string, role: string, corrections?: Partial<{
    companyId: string; workDiscussed: string; assignedTo: string; deadline: string;
    currentStatus: string; pendingGap: string; followUpAction: string; priorityLevel: string;
  }>) {
    if (!this.isOwnerOrAdmin(reviewedBy, role)) {
      throw new ForbiddenException('Only admin or owner can review meeting notes');
    }

    const note = await this.prisma.meetingNote.findUnique({ where: { id } });
    if (!note) throw new NotFoundException('Meeting note not found');

    return this.prisma.meetingNote.update({
      where: { id },
      data: {
        needsAdminReview: false,
        adminReviewedBy: reviewedBy,
        adminReviewedAt: new Date(),
        ...(corrections?.companyId && { companyId: corrections.companyId }),
        ...(corrections?.workDiscussed && { workDiscussed: corrections.workDiscussed }),
        ...(corrections?.assignedTo && { assignedTo: corrections.assignedTo }),
        ...(corrections?.deadline && { deadline: new Date(corrections.deadline) }),
        ...(corrections?.currentStatus && { currentStatus: corrections.currentStatus }),
        ...(corrections?.pendingGap && { pendingGap: corrections.pendingGap }),
        ...(corrections?.followUpAction && { followUpAction: corrections.followUpAction }),
        ...(corrections?.priorityLevel && { priorityLevel: corrections.priorityLevel }),
      },
    });
  }
}
