import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

export const QUEUE_EMAIL_NAME = 'email';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_EMAIL_NAME,
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
