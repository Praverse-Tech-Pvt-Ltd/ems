import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async send(
    employeeId: string,
    type: NotificationType,
    title: string,
    body: string,
    referenceId?: string,
    referenceType?: string,
  ) {
    return this.prisma.notification.create({
      data: { employeeId, type, title, body, referenceId, referenceType },
    });
  }

  async findMy(employeeId: string) {
    return this.prisma.notification.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, employeeId: string) {
    return this.prisma.notification.updateMany({
      where: { id, employeeId },
      data: { isRead: true },
    });
  }

  async markAllRead(employeeId: string) {
    return this.prisma.notification.updateMany({
      where: { employeeId, isRead: false },
      data: { isRead: true },
    });
  }

  async unreadCount(employeeId: string) {
    return this.prisma.notification.count({
      where: { employeeId, isRead: false },
    });
  }

  async broadcast(title: string, body: string) {
    const employees = await this.prisma.employee.findMany({ select: { id: true } });
    await this.prisma.notification.createMany({
      data: employees.map(e => ({
        employeeId: e.id,
        type: 'GENERAL' as NotificationType,
        title,
        body,
      })),
    });
    return { sent: employees.length };
  }
}
