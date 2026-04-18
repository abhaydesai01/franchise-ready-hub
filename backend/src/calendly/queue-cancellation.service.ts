import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getSingletonBullConnection } from '../queues/redis-connection';

const QUEUE_NAMES = [
  'nurture-sequence',
  'booking-sequence',
  'voice-out',
  'voice-fallback',
  'whatsapp-out',
  'scoring-nudge',
  'calendly-reminders',
  'document-generation',
  'proposal-followup',
  'calendar-reminders',
  'sprint7-proposal',
  'sprint7-mom',
] as const;

/**
 * Mirrors CRM `cancelLeadJobs` — removes delayed/waiting jobs whose payload includes `leadId`.
 */
@Injectable()
export class QueueCancellationService {
  private readonly log = new Logger(QueueCancellationService.name);

  private getConnection() {
    try {
      return getSingletonBullConnection();
    } catch {
      return null;
    }
  }

  async cancelAllJobsForLead(leadId: string): Promise<void> {
    const conn = this.getConnection();
    if (!conn) {
      this.log.warn('Redis unavailable — skip BullMQ job cancellation');
      return;
    }

    for (const name of QUEUE_NAMES) {
      const q = new Queue(name, { connection: conn });
      try {
        const jobs = await q.getJobs(['delayed', 'waiting', 'paused']);
        for (const job of jobs) {
          const data = job.data as { leadId?: string };
          if (data.leadId && String(data.leadId) === leadId) {
            try {
              await job.remove();
            } catch (e) {
              this.log.warn(`remove job ${job.id}`, e);
            }
          }
        }
      } finally {
        await q.close();
      }
    }
  }

}
