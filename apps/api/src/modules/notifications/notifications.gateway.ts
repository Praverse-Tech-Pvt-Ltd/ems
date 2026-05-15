import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true, namespace: '/notifications' })
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { employeeId: string },
  ) {
    void client.join(`employee:${data.employeeId}`);
  }

  sendToEmployee(employeeId: string, event: string, payload: unknown) {
    this.server.to(`employee:${employeeId}`).emit(event, payload);
  }
}
