import { Module } from '@nestjs/common';
import { QueueCancellationService } from '../calendly/queue-cancellation.service';

@Module({
  providers: [QueueCancellationService],
  exports: [QueueCancellationService],
})
export class QueueCancellationModule {}
