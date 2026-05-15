import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { user, method, ip, headers } = request;

    if (!user || !['POST', 'PATCH', 'DELETE', 'PUT'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          await this.prisma.auditLog.create({
            data: {
              actorId: user.id,
              action: method,
              resourceType: context.getClass().name,
              newValue: responseData as object,
              ipAddress: ip,
              userAgent: headers['user-agent'] ?? '',
            },
          });
        } catch {
          // Audit log failures must never break the request
        }
      }),
    );
  }
}
