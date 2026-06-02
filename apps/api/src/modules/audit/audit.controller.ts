import { Controller, Get, Query, UseGuards, OnModuleInit } from '@nestjs/common';
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
export class AuditController implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.migratePunchNotifications();
    } catch (err) {
      console.error('Failed to migrate punch notifications:', err);
    }
  }

  private async migratePunchNotifications() {
    const notifications = await this.prisma.notification.findMany({
      where: {
        type: {
          in: ['PUNCH_IN', 'PUNCH_OUT', 'MISSING_PUNCH_OUT'],
        },
      },
    });

    if (notifications.length === 0) return;

    for (const notif of notifications) {
      const exists = await this.prisma.auditLog.findFirst({
        where: {
          actorId: notif.employeeId,
          action: notif.type,
          resourceId: notif.referenceId,
        },
      });

      if (!exists) {
        const nv: Record<string, any> = {};
        const body = notif.body || '';

        if (body.toUpperCase().includes('USED MANUAL')) {
          nv.isManual = true;
          nv.status = 'PRESENT';
          nv.location = 'OFFICE';
          const timeMatch = body.match(/AT\s+(\d{2}:\d{2}\s+[AP]M)/i);
          if (timeMatch?.[1]) nv.time = timeMatch[1];
          const reasonMatch = body.match(/REASON:\s*(.*)$/i);
          if (reasonMatch?.[1]) nv.manualPunchReason = reasonMatch[1].trim();
        } else if (body.toUpperCase().includes('OUTSIDE THE OFFICE')) {
          nv.isManual = false;
          nv.location = 'REMOTE';
          nv.isGeoValidIn = false;
          nv.isGeoValidOut = false;
          const gpsMatch = body.match(/GPS:\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)/i);
          if (gpsMatch?.[1] && gpsMatch?.[2]) {
            nv.latitude = parseFloat(gpsMatch[1]);
            nv.longitude = parseFloat(gpsMatch[2]);
          }
        } else {
          nv.status = notif.type;
          nv.message = body;
        }

        await this.prisma.auditLog.create({
          data: {
            actorId: notif.employeeId,
            action: notif.type,
            resourceType: 'attendance',
            resourceId: notif.referenceId,
            createdAt: notif.createdAt,
            newValue: nv,
          },
        });
      }
    }

    await this.prisma.notification.deleteMany({
      where: {
        id: {
          in: notifications.map((n) => n.id),
        },
      },
    });

    console.log(`Migrated ${notifications.length} punch notifications to audit log`);
  }

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

     const where: Record<string, any> = {
      resourceType: {
        notIn: ['ChatController', 'ChatMessage', 'chat_messages', 'chat_channel', 'ChatChannel'],
      },
    };
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
