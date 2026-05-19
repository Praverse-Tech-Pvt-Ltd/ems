import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { QUEUE_EMAIL_NAME } from './email.constants';

export { QUEUE_EMAIL_NAME };

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
