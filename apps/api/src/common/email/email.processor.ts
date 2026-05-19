import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { EmailService } from './email.service';
import { QUEUE_EMAIL_NAME } from './email.module';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Processor(QUEUE_EMAIL_NAME)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  @Process()
  async handleEmailJob(job: Job<any>) {
    this.logger.log(`Processing email job ${job.id} for action: ${job.data.action}`);
    try {
      await this.emailService.executeSendJob(job.data);
    } catch (err) {
      this.logger.error(`Error processing email job ${job.id}: ${(err as Error).message}`);
      
      // Log failed job to Prisma AuditLog as requested
      let actorId = job.data.employeeId;
      if (!actorId) {
        // Fallback: Query first administrator to satisfy the required foreign key relation
        const admin = await this.prisma.employee.findFirst({
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        });
        actorId = admin?.id;
      }
      
      if (actorId) {
        try {
          await this.prisma.auditLog.create({
            data: {
              actorId,
              action: 'EMAIL_SEND_FAILED',
              resourceType: 'EMAIL',
              newValue: { error: (err as Error).message, jobData: job.data },
            },
          });
        } catch (dbErr) {
          this.logger.error(`Failed to log email error to DB AuditLog: ${(dbErr as Error).message}`);
        }
      }
      
      // Re-throw to trigger BullMQ's retry mechanism
      throw err;
    }
  }
}
