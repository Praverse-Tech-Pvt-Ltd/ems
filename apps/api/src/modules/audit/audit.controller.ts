import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('audit-logs')
export class AuditController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiQuery({ name: 'cursor', required: false, description: 'ID of last record from previous page' })
  @ApiQuery({ name: 'limit', required: false, description: `Page size (max ${MAX_PAGE_SIZE})` })
  async findAll(
    @Query('actorId') actorId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = Math.min(
      parseInt(limitStr ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE,
    );

    const where: Record<string, unknown> = {};
    if (actorId) where['actorId'] = actorId;
    if (resourceType) where['resourceType'] = resourceType;
    if (action) where['action'] = action;
    if (from || to) {
      where['createdAt'] = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { firstName: true, lastName: true, employeeCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      // Cursor-based pagination: skip 1 to exclude the cursor record itself.
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: limit,
    });

    return {
      data: rows,
      nextCursor: rows.length === limit ? rows[rows.length - 1]?.id : null,
    };
  }
}
