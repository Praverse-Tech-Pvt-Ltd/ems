import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
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

import { ChatModule } from './modules/chat/chat.module';
import { ClientCompaniesModule } from './modules/client-companies/client-companies.module';
import { MeetingNotesModule } from './modules/meeting-notes/meeting-notes.module';
import { WorkUpdatesModule } from './modules/work-updates/work-updates.module';
import { AIOverviewModule } from './modules/ai-overview/ai-overview.module';
import { CompanyCalendarModule } from './modules/company-calendar/company-calendar.module';
import { ManagementReviewModule } from './modules/management-review/management-review.module';
import { AuditReadinessModule } from './modules/audit-readiness/audit-readiness.module';
import { CompanyDocumentsModule } from './modules/company-documents/company-documents.module';
import { ClientCommunicationsModule } from './modules/client-communications/client-communications.module';
import { FollowUpTasksModule } from './modules/follow-up-tasks/follow-up-tasks.module';
import { AIChatModule } from './modules/ai-chat/ai-chat.module';
import { AIProposalsModule } from './modules/ai-proposals/ai-proposals.module';
import { ZohoSyncModule } from './modules/zoho-sync/zoho-sync.module';
import { CompanyTrackerModule } from './modules/company-tracker/company-tracker.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Default: 300 requests per 60 s per IP — raised from 100 because the
    // dashboard fires many parallel widget/detail requests per navigation and
    // an office shares one IP across the whole team, which was tripping 429s
    // during normal use.
    // Auth endpoints override this with a stricter 'auth' named throttler (5/60s).
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 5000 },
      { name: 'auth', ttl: 60_000, limit: 15 },
    ]),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>('REDIS_URL');
        const parsed = new URL(redisUrl);
        const isTls = parsed.protocol === 'rediss:';
        return {
          connection: {
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

    ChatModule,
    AIOverviewModule,
    ClientCompaniesModule,
    MeetingNotesModule,
    WorkUpdatesModule,
    CompanyCalendarModule,
    ManagementReviewModule,
    AuditReadinessModule,
    CompanyDocumentsModule,
    ClientCommunicationsModule,
    FollowUpTasksModule,
    AIProposalsModule,
    AIChatModule,
    ZohoSyncModule,
    CompanyTrackerModule,
  ],
  // Apply ThrottlerGuard globally so every route is rate-limited by default.
  // Individual routes/controllers can override limits with @Throttle().
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
