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

const socketOrigins = [
  process.env['FRONTEND_URL'],
  process.env['CORS_ALLOWED_ORIGINS'],
]
  .filter(Boolean)
  .flatMap((value) => value!.split(',').map((origin) => origin.trim()))
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    // Restrict to known frontend origins — never allow '*'.
    origin: [
      ...socketOrigins,
      'https://ems.nexgenpharmasolutions.com',
      'http://localhost:3000',
    ],
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

      const payload = this.jwtService.verify<{ sub: string; role?: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      // Store the verified user id on the socket for later use.
      client.data.userId = payload.sub;

      // Join the employee-scoped room using the identity from the JWT, not
      // from any client-provided message body.
      void client.join(`employee:${payload.sub}`);

      // Admins/super-admins also join a shared broadcast room so
      // team-wide views (e.g. the admin "Team Today" list) can live-update.
      // The role claim here is trusted only for notification *delivery*,
      // not for authorizing any action — actual authorization is always
      // re-checked server-side via RolesGuard against the current DB role.
      if (payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN') {
        void client.join('admins');
      }
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

  broadcastToAdmins(event: string, payload: unknown): void {
    this.server.to('admins').emit(event, payload);
  }
}
