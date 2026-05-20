import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

interface AuthSocket extends Socket {
  employeeId: string;
}

@WebSocketGateway({ cors: true, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  handleConnection(client: AuthSocket) {
    // employeeId passed via auth handshake: { auth: { employeeId } }
    const empId = client.handshake.auth?.employeeId as string | undefined;
    if (!empId) {
      client.disconnect();
      return;
    }
    client.employeeId = empId;
    // Join personal room for targeted events
    void client.join(`user:${empId}`);
  }

  @SubscribeMessage('join-channel')
  handleJoinChannel(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { channelId: string },
  ) {
    void client.join(`channel:${data.channelId}`);
  }

  @SubscribeMessage('leave-channel')
  handleLeaveChannel(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { channelId: string },
  ) {
    void client.leave(`channel:${data.channelId}`);
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { channelId: string; body: string },
  ) {
    const { channelId, body } = data;
    const authorId = client.employeeId;
    if (!authorId || !channelId || !body?.trim()) return;

    try {
      const message = await this.chatService.createMessage(channelId, authorId, body.trim());

      // Broadcast to everyone in the channel room (including sender for ack)
      this.server.to(`channel:${channelId}`).emit('new-message', message);

      // Push notification to members NOT in this socket room (offline or on different channel)
      const memberIds = await this.chatService.getChannelMemberIds(channelId);
      for (const memberId of memberIds) {
        if (memberId === authorId) continue;
        this.notificationsGateway.sendToEmployee(memberId, 'CHAT_MESSAGE', {
          channelId,
          messageId: message.id,
          authorName: `${message.author.firstName} ${message.author.lastName}`,
          body: message.body.slice(0, 80),
        });
      }
    } catch {
      client.emit('error', { message: 'Failed to send message' });
    }
  }

  @SubscribeMessage('delete-message')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { messageId: string },
  ) {
    if (!client.employeeId || !data.messageId) return;
    try {
      const result = await this.chatService.deleteMessage(data.messageId, client.employeeId);
      // Broadcast to everyone in the channel so all clients remove it instantly
      this.server
        .to(`channel:${result.channelId}`)
        .emit('message-deleted', { messageId: result.messageId, channelId: result.channelId });
    } catch {
      client.emit('error', { message: 'Failed to delete message' });
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { channelId: string; isTyping: boolean },
  ) {
    client.to(`channel:${data.channelId}`).emit('typing', {
      employeeId: client.employeeId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.employeeId || !data.channelId) return;
    await this.chatService.markRead(data.channelId, client.employeeId);
  }

  @SubscribeMessage('delete-messages')
  async handleDeleteMessages(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { channelId: string; messageIds: string[] },
  ) {
    if (!client.employeeId || !data.channelId || !data.messageIds?.length) return;
    try {
      const deleted = await this.chatService.bulkDeleteMessages(
        data.channelId,
        data.messageIds,
        client.employeeId,
      );
      this.server
        .to(`channel:${data.channelId}`)
        .emit('messages-deleted', { channelId: data.channelId, messageIds: deleted });
    } catch {
      client.emit('error', { message: 'Failed to delete messages' });
    }
  }

  @SubscribeMessage('delete-conversation')
  async handleDeleteConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.employeeId || !data.channelId) return;
    try {
      const result = await this.chatService.deleteConversation(data.channelId, client.employeeId);
      // Notify every former member before the record is gone
      for (const memberId of result.memberIds) {
        this.server
          .to(`user:${memberId}`)
          .emit('conversation-deleted', { channelId: result.channelId, action: result.action });
      }
    } catch {
      client.emit('error', { message: 'Failed to delete conversation' });
    }
  }
}
