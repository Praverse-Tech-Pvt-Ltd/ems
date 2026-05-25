import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { RequestType, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

const VALID_REQUEST_STATUSES = new Set<string>(Object.values(RequestStatus));

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'] as const;

@Injectable()
export class RequestsService {
  constructor(private prisma: PrismaService) {}

  async create(
    employeeId: string,
    requestType: RequestType,
    details: Record<string, unknown>,
  ) {
    return this.prisma.employeeRequest.create({
      data: { employeeId, requestType, details: details as never, status: 'PENDING' },
    });
  }

  async findMy(employeeId: string) {
    return this.prisma.employeeRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(status?: string) {
    if (status && !VALID_REQUEST_STATUSES.has(status)) {
      throw new BadRequestException(`Invalid status value: ${status}`);
    }
    const where = status ? { status: status as RequestStatus } : {};
    return this.prisma.employeeRequest.findMany({
      where,
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeCode: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetch a single request.
   * - Admin / manager roles may read any request.
   * - Regular employees may only view their own request.
   */
  async findOne(id: string, requestor: { id: string; role: string }) {
    const req = await this.prisma.employeeRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');

    const isPrivileged = (ADMIN_ROLES as readonly string[]).includes(requestor.role);
    if (!isPrivileged && req.employeeId !== requestor.id) {
      throw new ForbiddenException('Access denied');
    }

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
