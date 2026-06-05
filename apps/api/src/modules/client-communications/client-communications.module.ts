import { Module } from '@nestjs/common';
import { ClientCommunicationsController } from './client-communications.controller';
import { ClientCommunicationsService } from './client-communications.service';

@Module({
  controllers: [ClientCommunicationsController],
  providers: [ClientCommunicationsService],
  exports: [ClientCommunicationsService],
})
export class ClientCommunicationsModule {}
