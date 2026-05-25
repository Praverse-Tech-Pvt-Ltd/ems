import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Extract a safe, minimal summary from the response for the audit log.
 *
 * We deliberately DO NOT log the full response payload — it may contain
 * salary figures, personal data, or other sensitive information.
 * Instead we record only the top-level ID (if present) so the record can
 * be correlated with the source row, plus the resource type and action.
 */
function buildAuditSummary(response: unknown): object {
  if (response === null || typeof response !== 'object') return {};
  const r = response as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  if (typeof r['id'] === 'string') summary['id'] = r['id'];
  if (typeof r['status'] === 'string') summary['status'] = r['status'];
  return summary;
}

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
              newValue: buildAuditSummary(responseData),
              ipAddress: ip,
              userAgent: headers['user-agent'] ?? '',
            },
          });
        } catch {
          // Audit log failures must never break the request.
        }
      }),
    );
  }
}
