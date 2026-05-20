import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  /** All channels the employee is a member of, sorted by latest message */
  async getMyChannels(employeeId: string) {
    await this.ensureGeneralChannel(employeeId);
    const memberships = await this.prisma.chatChannelMember.findMany({
      where: { employeeId },
      include: {
        channel: {
          include: {
            members: {
              include: {
                employee: {
                  select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                author: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    const result = await Promise.all(
      memberships.map(async (m) => {
        const unread = m.lastReadAt
          ? await this.prisma.chatMessage.count({
              where: {
                channelId: m.channelId,
                createdAt: { gt: m.lastReadAt },
                authorId: { not: employeeId },
              },
            })
          : await this.prisma.chatMessage.count({
              where: { channelId: m.channelId, authorId: { not: employeeId } },
            });

        const ch = m.channel;
        // For DIRECT channels derive display name from the other member
        let displayName = ch.name;
        let otherMember: typeof ch.members[0]['employee'] | null = null;
        if (ch.type === 'DIRECT') {
          const other = ch.members.find((mem) => mem.employeeId !== employeeId);
          if (other) {
            otherMember = other.employee;
            displayName = `${other.employee.firstName} ${other.employee.lastName}`;
          }
        }

        return {
          id: ch.id,
          name: displayName,
          type: ch.type,
          members: ch.members.map((mem) => mem.employee),
          lastMessage: ch.messages[0] ?? null,
          unread,
          lastReadAt: m.lastReadAt,
          otherMember,
        };
      }),
    );

    // Sort: channels with messages first (by latest message), then rest
    return result.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt?.getTime() ?? 0;
      const bTime = b.lastMessage?.createdAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }

  /**
   * Ensure a GENERAL channel exists and the employee is a member.
   * Called lazily on first channel list load.
   */
  async ensureGeneralChannel(employeeId: string) {
    let general = await this.prisma.chatChannel.findFirst({
      where: { type: 'GENERAL', name: 'General' },
    });

    if (!general) {
      // Create it and add all active employees
      const employees = await this.prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      general = await this.prisma.chatChannel.create({
        data: {
          name: 'General',
          type: 'GENERAL',
          members: { create: employees.map((e) => ({ employeeId: e.id })) },
        },
      });
      return;
    }

    // Make sure this employee is a member
    await this.prisma.chatChannelMember.upsert({
      where: { channelId_employeeId: { channelId: general.id, employeeId } },
      create: { channelId: general.id, employeeId },
      update: {},
    });
  }

  /** Get or create a DIRECT channel between two employees */
  async getOrCreateDirect(meId: string, otherId: string) {
    if (meId === otherId) throw new ForbiddenException('Cannot create DM with yourself');

    // Look for existing direct channel containing exactly both members
    const existing = await this.prisma.chatChannel.findFirst({
      where: {
        type: 'DIRECT',
        members: { some: { employeeId: meId } },
        AND: [{ members: { some: { employeeId: otherId } } }],
      },
      include: { members: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } } },
    });

    if (existing) return existing;

    const other = await this.prisma.employee.findUnique({
      where: { id: otherId },
      select: { firstName: true, lastName: true },
    });
    if (!other) throw new NotFoundException('Employee not found');

    return this.prisma.chatChannel.create({
      data: {
        name: `dm:${meId}:${otherId}`,
        type: 'DIRECT',
        createdBy: meId,
        members: {
          create: [{ employeeId: meId }, { employeeId: otherId }],
        },
      },
      include: { members: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } } },
    });
  }

  /** Create a GROUP channel */
  async createGroup(name: string, memberIds: string[], createdBy: string) {
    const allIds = [...new Set([createdBy, ...memberIds])];
    return this.prisma.chatChannel.create({
      data: {
        name,
        type: 'GROUP',
        createdBy,
        members: { create: allIds.map((id) => ({ employeeId: id })) },
      },
      include: { members: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } } },
    });
  }

  /** Paginated messages for a channel (cursor = last message id) */
  async getMessages(channelId: string, employeeId: string, cursor?: string, limit = 30) {
    await this.assertMember(channelId, employeeId);

    const messages = await this.prisma.chatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        author: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    return { messages: messages.reverse(), hasMore, nextCursor: hasMore ? messages[0]?.id : null };
  }

  /** Persist a message and return it with author */
  async createMessage(channelId: string, authorId: string, body: string) {
    await this.assertMember(channelId, authorId);

    const message = await this.prisma.chatMessage.create({
      data: { channelId, authorId, body },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    });

    return message;
  }

  /** Update lastReadAt for unread tracking */
  async markRead(channelId: string, employeeId: string) {
    await this.prisma.chatChannelMember.updateMany({
      where: { channelId, employeeId },
      data: { lastReadAt: new Date() },
    });
  }

  /** Bulk-delete multiple messages — silently skips any that aren't authored by requester */
  async bulkDeleteMessages(
    channelId: string,
    messageIds: string[],
    requesterId: string,
  ): Promise<string[]> {
    await this.assertMember(channelId, requesterId);
    // Only delete own messages
    await this.prisma.chatMessage.deleteMany({
      where: { id: { in: messageIds }, channelId, authorId: requesterId },
    });
    return messageIds; // return all requested IDs; clients remove what they can
  }

  /**
   * Delete a DIRECT conversation entirely, or leave a GROUP.
   * Returns the channelId and all former member IDs so the gateway
   * can notify everyone before the record is gone.
   */
  async deleteConversation(
    channelId: string,
    requesterId: string,
  ): Promise<{ channelId: string; memberIds: string[]; action: 'deleted' | 'left' }> {
    const channel = await this.prisma.chatChannel.findUnique({
      where: { id: channelId },
      include: { members: { select: { employeeId: true } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const memberIds = channel.members.map((m) => m.employeeId);
    if (!memberIds.includes(requesterId)) throw new ForbiddenException('Not a member');

    if (channel.type === 'GENERAL') {
      throw new ForbiddenException('The General channel cannot be deleted');
    }

    if (channel.type === 'DIRECT') {
      // Hard-delete — removes messages via cascade
      await this.prisma.chatChannel.delete({ where: { id: channelId } });
      return { channelId, memberIds, action: 'deleted' };
    }

    // GROUP — just remove the requester
    await this.prisma.chatChannelMember.deleteMany({
      where: { channelId, employeeId: requesterId },
    });
    return { channelId, memberIds, action: 'left' };
  }

  /** Delete a message — only the author can do this */
  async deleteMessage(messageId: string, requesterId: string): Promise<{ messageId: string; channelId: string }> {
    if (!messageId) throw new BadRequestException('messageId required');

    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, authorId: true, channelId: true },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.authorId !== requesterId) throw new ForbiddenException('You can only delete your own messages');

    await this.prisma.chatMessage.delete({ where: { id: messageId } });
    return { messageId, channelId: message.channelId };
  }

  /** Fetch all memberIds for a channel (for push notifications) */
  async getChannelMemberIds(channelId: string): Promise<string[]> {
    const members = await this.prisma.chatChannelMember.findMany({
      where: { channelId },
      select: { employeeId: true },
    });
    return members.map((m) => m.employeeId);
  }

  private async assertMember(channelId: string, employeeId: string) {
    const membership = await this.prisma.chatChannelMember.findUnique({
      where: { channelId_employeeId: { channelId, employeeId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this channel');
  }
}
