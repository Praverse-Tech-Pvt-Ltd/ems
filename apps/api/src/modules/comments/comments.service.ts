import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

type ResourceType = 'expense' | 'invoice' | 'leaveRequest' | 'employeeRequest';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async create(authorId: string, body: string, resourceType: ResourceType, resourceId: string) {
    const data: Record<string, unknown> = { authorId, body };

    switch (resourceType) {
      case 'expense': data['expenseId'] = resourceId; break;
      case 'invoice': data['invoiceId'] = resourceId; break;
      case 'leaveRequest': data['leaveRequestId'] = resourceId; break;
      case 'employeeRequest': data['employeeRequestId'] = resourceId; break;
    }

    return this.prisma.comment.create({
      data: data as Parameters<typeof this.prisma.comment.create>[0]['data'],
      include: { author: { select: { firstName: true, lastName: true, profilePhotoUrl: true } } },
    });
  }

  async findByResource(resourceType: ResourceType, resourceId: string) {
    const where: Record<string, unknown> = {};
    switch (resourceType) {
      case 'expense': where['expenseId'] = resourceId; break;
      case 'invoice': where['invoiceId'] = resourceId; break;
      case 'leaveRequest': where['leaveRequestId'] = resourceId; break;
      case 'employeeRequest': where['employeeRequestId'] = resourceId; break;
    }

    return this.prisma.comment.findMany({
      where,
      include: { author: { select: { firstName: true, lastName: true, profilePhotoUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
