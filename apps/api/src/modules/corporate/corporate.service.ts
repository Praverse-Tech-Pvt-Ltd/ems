import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateChannelDto,
  CreateHolidayDto,
  CreateLifecycleDto,
  CreatePolicyDto,
  CreateTaskDto,
} from './dto/corporate.dto';

@Injectable()
export class CorporateService {
  constructor(private prisma: PrismaService) {}

  settings() {
    return this.prisma.companySetting.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertSetting(userId: string, key: string, value: Record<string, unknown>) {
    const setting = await this.prisma.companySetting.upsert({
      where: { key },
      update: { value: value as any, updatedBy: userId },
      create: { key, value: value as any, updatedBy: userId },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'SETTING_UPSERT',
        resourceType: 'company_setting',
        resourceId: setting.id,
        newValue: setting as object,
      },
    });
    return setting;
  }

  holidays() {
    return this.prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  }

  async createHoliday(userId: string, dto: CreateHolidayDto) {
    const holiday = await this.prisma.holiday.create({
      data: {
        date: new Date(dto.date),
        title: dto.title,
        description: dto.description ?? undefined,
        isPaid: dto.isPaid ?? true,
        createdBy: userId,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'HOLIDAY_CREATE',
        resourceType: 'holiday',
        resourceId: holiday.id,
        newValue: holiday as object,
      },
    });
    return holiday;
  }

  async deleteHoliday(userId: string, id: string) {
    const holiday = await this.prisma.holiday.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'HOLIDAY_DELETE',
        resourceType: 'holiday',
        resourceId: id,
        oldValue: holiday as object,
      },
    });
    return { ok: true };
  }

  policies(employeeId: string, includeDrafts = false) {
    return this.prisma.policy.findMany({
      where: includeDrafts ? {} : { status: 'PUBLISHED' },
      include: {
        acknowledgements: {
          where: { employeeId },
          select: { acknowledgedAt: true },
        },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async createPolicy(userId: string, dto: CreatePolicyDto) {
    const status = dto.status ?? 'PUBLISHED';
    const policy = await this.prisma.policy.create({
      data: {
        title: dto.title,
        category: dto.category,
        body: dto.body,
        version: dto.version ?? '1.0',
        status,
        createdBy: userId,
        publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'POLICY_CREATE',
        resourceType: 'policy',
        resourceId: policy.id,
        newValue: policy as object,
      },
    });
    return policy;
  }

  async acknowledgePolicy(employeeId: string, policyId: string) {
    const policy = await this.prisma.policy.findUniqueOrThrow({ where: { id: policyId } });
    const ack = await this.prisma.policyAcknowledgement.upsert({
      where: { policyId_employeeId: { policyId, employeeId } },
      update: { acknowledgedAt: new Date() },
      create: { policyId, employeeId },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: employeeId,
        action: 'POLICY_ACKNOWLEDGED',
        resourceType: 'policy',
        resourceId: policy.id,
        newValue: { policyTitle: policy.title },
      },
    });
    return ack;
  }

  myTasks(employeeId: string) {
    return this.prisma.taskAssignment.findMany({
      where: { employeeId },
      include: {
        task: { include: { creator: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  adminTasks() {
    return this.prisma.task.findMany({
      include: {
        creator: { select: { firstName: true, lastName: true } },
        assignments: {
          include: {
            employee: {
              select: { firstName: true, lastName: true, employeeCode: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description ?? undefined,
        priority: dto.priority ?? 'NORMAL',
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        createdBy: userId,
        assignments: {
          create: dto.employeeIds.map((employeeId) => ({ employeeId })),
        },
      },
      include: { assignments: true },
    });

    await this.prisma.notification.createMany({
      data: dto.employeeIds.map((employeeId) => ({
        employeeId,
        type: 'GENERAL',
        title: 'New task assigned',
        body: task.title,
        referenceId: task.id,
        referenceType: 'task',
      })),
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'TASK_ASSIGNED',
        resourceType: 'task',
        resourceId: task.id,
        newValue: { title: task.title, employeeIds: dto.employeeIds },
      },
    });

    return task;
  }

  async completeTask(employeeId: string, assignmentId: string) {
    const assignment = await this.prisma.taskAssignment.findFirst({
      where: { id: assignmentId, employeeId },
    });
    if (!assignment) throw new NotFoundException('Task assignment not found');
    return this.prisma.taskAssignment.update({
      where: { id: assignmentId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async channels(user: { id: string; role?: string }) {
    const existing = await this.prisma.chatChannel.findFirst({ where: { type: 'GENERAL' } });
    if (!existing) {
      await this.prisma.chatChannel.create({
        data: { name: 'General Organisation', type: 'GENERAL' },
      });
    }
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    return this.prisma.chatChannel.findMany({
      where: isAdmin
        ? {}
        : {
            OR: [
              { type: 'GENERAL' },
              { members: { some: { employeeId: user.id } } },
            ],
          },
      include: {
        members: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeCode: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createChannel(userId: string, dto: CreateChannelDto) {
    const memberIds = Array.from(new Set([userId, ...dto.employeeIds]));
    const type = memberIds.length === 2 ? 'DIRECT' : 'GROUP';
    const channel = await this.prisma.chatChannel.create({
      data: {
        name: dto.name ?? (type === 'DIRECT' ? 'Direct Chat' : 'Team Chat'),
        type,
        createdBy: userId,
        members: { create: memberIds.map((employeeId) => ({ employeeId })) },
      },
      include: {
        members: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeCode: true },
            },
          },
        },
      },
    });

    await this.prisma.notification.createMany({
      data: dto.employeeIds.map((employeeId) => ({
        employeeId,
        type: 'GENERAL',
        title: 'New chat started',
        body: channel.name,
        referenceId: channel.id,
        referenceType: 'chat_channel',
      })),
    });

    return channel;
  }

  private async canAccessChannel(
    user: { id: string; role?: string },
    channelId: string,
  ): Promise<boolean> {
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
    const channel = await this.prisma.chatChannel.findFirst({
      where: {
        id: channelId,
        OR: [{ type: 'GENERAL' }, { members: { some: { employeeId: user.id } } }],
      },
    });
    return !!channel;
  }

  async messages(user: { id: string; role?: string }, channelId: string) {
    if (!(await this.canAccessChannel(user, channelId))) {
      throw new NotFoundException('Chat channel not found');
    }
    return this.prisma.chatMessage.findMany({
      where: { channelId },
      include: {
        author: {
          select: { firstName: true, lastName: true, employeeCode: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async sendMessage(
    user: { id: string; role?: string },
    channelId: string,
    messageBody: string,
  ) {
    if (!(await this.canAccessChannel(user, channelId))) {
      throw new NotFoundException('Chat channel not found');
    }
    return this.prisma.chatMessage.create({
      data: {
        channelId,
        authorId: user.id,
        body: messageBody,
      },
      include: {
        author: {
          select: { firstName: true, lastName: true, employeeCode: true, role: true },
        },
      },
    });
  }

  lifecycle(employeeId?: string) {
    return this.prisma.employeeLifecycleEvent.findMany({
      where: employeeId ? { employeeId } : {},
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        creator: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createLifecycle(userId: string, dto: CreateLifecycleDto) {
    return this.prisma.employeeLifecycleEvent.create({
      data: {
        employeeId: dto.employeeId,
        eventType: dto.eventType,
        title: dto.title,
        description: dto.description ?? undefined,
        status: dto.status ?? 'OPEN',
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        createdBy: userId,
      },
    });
  }
}
