import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestType } from '@prisma/client';

@Injectable()
export class RequestsService {
  constructor(private prisma: PrismaService) {}

  async create(employeeId: string, requestType: RequestType, details: Record<string, unknown>) {
    return this.prisma.employeeRequest.create({
      data: { employeeId, requestType, details: details as any, status: 'PENDING' },
    });
  }

  async findMy(employeeId: string) {
    return this.prisma.employeeRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(status?: string) {
    const where = status ? { status: status as never } : {};
    return this.prisma.employeeRequest.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const req = await this.prisma.employeeRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    return req;
  }

  async updateStatus(
    id: string,
    reviewerId: string,
    status: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW',
    comment?: string,
  ) {
    return this.prisma.employeeRequest.update({
      where: { id },
      data: { status, reviewedBy: reviewerId, reviewedAt: new Date(), comment },
    });
  }
}
