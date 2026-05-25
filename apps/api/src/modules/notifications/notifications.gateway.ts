import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    // Restrict to known frontend origins — never allow '*'.
    origin: (process.env['FRONTEND_URL'] ?? 'http://localhost:3000').split(','),
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Called automatically when a WebSocket client connects.
   * Verifies the JWT from the handshake and joins the room tied to the
   * *token's* subject — never from client-supplied data.
   * Unauthenticated or expired tokens immediately disconnect the socket.
   */
  handleConnection(client: Socket): void {
    try {
      // Accept token from `auth.token` (preferred) or Authorization header.
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      // Store the verified user id on the socket for later use.
      client.data.userId = payload.sub;

      // Join the employee-scoped room using the identity from the JWT, not
      // from any client-provided message body.
      void client.join(`employee:${payload.sub}`);
    } catch {
      // Invalid / expired token — terminate the connection immediately.
      client.disconnect(true);
    }
  }

  /**
   * Kept for backward compatibility with frontend clients that still send a
   * 'join' message. The room is already joined on connection from the JWT;
   * this handler is intentionally a no-op and ignores the message body.
   */
  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() _client: Socket): void {
    // No-op: room join happens in handleConnection via verified JWT.
  }

  sendToEmployee(employeeId: string, event: string, payload: unknown): void {
    this.server.to(`employee:${employeeId}`).emit(event, payload);
  }
}
