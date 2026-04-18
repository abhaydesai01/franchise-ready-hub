import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getSingletonBullConnection } from '../queues/redis-connection';

export type ProposalFollowupJobData = {
  leadId: string;
  documentEntryId: string;
};

@Injectable()
export class ProposalFollowupQueueService {
  private readonly log = new Logger(ProposalFollowupQueueService.name);

  async scheduleForProposalSent(
    leadId: string,
    documentEntryId: string,
    _proposalSentAt: Date,
  ): Promise<void> {
    try {
      const conn = getSingletonBullConnection();
      const q = new Queue('proposal-followup', { connection: conn });
      try {
        const base = { leadId, documentEntryId };
        const delay48h = 48 * 60 * 60 * 1000;
        const delay7d = 7 * 24 * 60 * 60 * 1000;

        await q.add(
          'PROPOSAL_CHECKIN_48H',
          base,
          {
            jobId: `PROPOSAL_CHECKIN_${leadId}_${documentEntryId}`,
            delay: delay48h,
            attempts: 2,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: true,
          },
        );
        await q.add(
          'PROPOSAL_ESCALATE_7D',
          base,
          {
            jobId: `PROPOSAL_ESCALATE_${leadId}_${documentEntryId}`,
            delay: delay7d,
            attempts: 2,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: true,
          },
        );
        this.log.log(
          `Scheduled proposal follow-up jobs for lead ${leadId} doc ${documentEntryId}`,
        );
      } finally {
        await q.close();
      }
    } catch (e) {
      this.log.error(`Failed to schedule proposal follow-up for ${leadId}`, e);
    }
  }
}
