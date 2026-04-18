import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getSingletonBullConnection } from '../queues/redis-connection';

/**
 * Post-call document generation — BullMQ `document-generation` queue, job name GENERATE_DOCUMENT.
 */
@Injectable()
export class PostCallPipelineService {
  private readonly log = new Logger(PostCallPipelineService.name);

  async enqueueProposalGeneration(leadId: string): Promise<void> {
    await this.enqueueGenerateDocument(leadId, 'proposal');
  }

  async enqueueMomGeneration(leadId: string): Promise<void> {
    await this.enqueueGenerateDocument(leadId, 'mom');
  }

  private async enqueueGenerateDocument(
    leadId: string,
    documentType: 'proposal' | 'mom',
  ): Promise<void> {
    try {
      const conn = getSingletonBullConnection();
      const q = new Queue('document-generation', { connection: conn });
      try {
        await q.add(
          'GENERATE_DOCUMENT',
          { leadId, documentType },
          {
            jobId: `GENERATE_DOCUMENT_${leadId}_${documentType}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 15_000 },
            removeOnComplete: true,
          },
        );
        this.log.log(
          `Queued GENERATE_DOCUMENT (${documentType}) for lead ${leadId}`,
        );
      } finally {
        await q.close();
      }
    } catch (e) {
      this.log.error(`Failed to queue GENERATE_DOCUMENT for ${leadId}`, e);
    }
  }
}
