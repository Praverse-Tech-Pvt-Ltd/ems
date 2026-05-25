import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './common/prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { EmailModule } from './common/email/email.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { LeavesModule } from './modules/leaves/leaves.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SalaryModule } from './modules/salary/salary.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { CommentsModule } from './modules/comments/comments.module';
import { CorporateModule } from './modules/corporate/corporate.module';
import { KeepAliveModule } from './common/keep-alive/keep-alive.module';
import { FaceRecognitionModule } from './modules/face-recognition/face-recognition.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default: 100 requests per 60 s per IP.
    // Auth endpoints override this with a stricter 'auth' named throttler (5/60s).
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'auth', ttl: 60_000, limit: 5 },
    ]),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>('REDIS_URL');
        const parsed = new URL(redisUrl);
        const isTls = parsed.protocol === 'rediss:';
        return {
          redis: {
            host: parsed.hostname,
            port: parseInt(parsed.port || (isTls ? '6380' : '6379'), 10),
            password: parsed.password || undefined,
            username: parsed.username || undefined,
            tls: isTls ? {} : undefined,
          },
        };
      },
      inject: [ConfigService],
    }),
    PrismaModule,
    StorageModule,
    EmailModule,
    AuthModule,
    EmployeesModule,
    AttendanceModule,
    ExpensesModule,
    InvoicesModule,
    LeavesModule,
    RequestsModule,
    SalaryModule,
    NotificationsModule,
    ReportsModule,
    AuditModule,
    CommentsModule,
    CorporateModule,
    KeepAliveModule,
    FaceRecognitionModule,
    ChatModule,
  ],
  // Apply ThrottlerGuard globally so every route is rate-limited by default.
  // Individual routes/controllers can override limits with @Throttle().
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
