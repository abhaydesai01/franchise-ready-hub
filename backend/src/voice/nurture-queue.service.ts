import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getSingletonBullConnection } from '../queues/redis-connection';

const MS_DAY = 24 * 60 * 60 * 1000;
const NURTURE_DAYS = [1, 3, 7, 14, 20] as const;
const NURTURE_KEYS = [
  'nurtureDay1',
  'nurtureDay3',
  'nurtureDay7',
  'nurtureDay14',
  'nurtureDay20',
] as const;

/** Enqueues the same 20-day drip as CRM `enqueueNurtureSequence`. */
@Injectable()
export class NurtureQueueService {
  private readonly log = new Logger(NurtureQueueService.name);

  async enqueue20DayDrip(input: {
    leadId: string;
    phone: string;
    name: string;
    delayMs?: number;
  }): Promise<void> {
    try {
      const conn = getSingletonBullConnection();
      const q = new Queue('nurture-sequence', { connection: conn });
      const base = input.delayMs ?? 10 * 60 * 1000;
      try {
        for (let i = 0; i < NURTURE_DAYS.length; i++) {
          const day = NURTURE_DAYS[i];
          const delay = base + day * MS_DAY;
          const templateKey = NURTURE_KEYS[i];
          await q.add(
            'nurture-step',
            {
              leadId: input.leadId,
              phone: input.phone,
              name: input.name,
              step: day,
              templateKey,
            },
            {
              delay,
              attempts: 3,
              backoff: { type: 'exponential', delay: 5000 },
              jobId: `nurture-${input.leadId}-day${day}`,
            },
          );
        }
      } finally {
        await q.close();
      }
    } catch (e) {
      this.log.error('enqueue20DayDrip failed', e);
    }
  }
}
