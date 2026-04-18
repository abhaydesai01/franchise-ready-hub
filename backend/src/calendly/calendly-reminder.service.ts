import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { getSingletonBullConnection } from '../queues/redis-connection';

export type CalendlyReminderJobData = {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  leadEmail?: string;
  meetingLink: string;
  scheduledAtIso: string;
  consultantEmail?: string;
  kind: '24h' | '1h';
};

@Injectable()
export class CalendlyReminderService {
  private readonly log = new Logger(CalendlyReminderService.name);

  async cancelReminderJobs(leadId: string): Promise<void> {
    try {
      const conn = getSingletonBullConnection();
      const q = new Queue('calendly-reminders', { connection: conn });
      try {
        for (const suffix of ['24h', '1h']) {
          const jobId = `cal-pre-${suffix}-${leadId}`;
          const job = await q.getJob(jobId);
          if (job) await job.remove();
        }
      } finally {
        await q.close();
      }
    } catch (e) {
      this.log.warn(`cancel reminders for ${leadId}`, e);
    }
  }

  async schedulePreCallReminders(input: {
    leadId: string;
    leadName: string;
    leadPhone?: string;
    leadEmail?: string;
    meetingLink: string;
    scheduledAt: Date;
    consultantEmail?: string;
  }): Promise<void> {
    try {
      const conn = getSingletonBullConnection();
      const q = new Queue('calendly-reminders', { connection: conn });
      const start = input.scheduledAt.getTime();
      const now = Date.now();
      const scheduledAtIso = input.scheduledAt.toISOString();

      const base = {
        leadId: input.leadId,
        leadName: input.leadName,
        leadPhone: input.leadPhone,
        leadEmail: input.leadEmail,
        meetingLink: input.meetingLink,
        scheduledAtIso,
        consultantEmail: input.consultantEmail,
      };

      const ms24 = start - 24 * 60 * 60 * 1000 - now;
      const ms1 = start - 60 * 60 * 1000 - now;

      try {
        if (ms24 > 60_000) {
          await q.add(
            'precall-24h',
            { ...base, kind: '24h' as const } satisfies CalendlyReminderJobData,
            {
              jobId: `cal-pre-24h-${input.leadId}`,
              delay: ms24,
              attempts: 2,
            },
          );
        }
        if (ms1 > 60_000) {
          await q.add(
            'precall-1h',
            { ...base, kind: '1h' as const } satisfies CalendlyReminderJobData,
            {
              jobId: `cal-pre-1h-${input.leadId}`,
              delay: ms1,
              attempts: 2,
            },
          );
        }
      } finally {
        await q.close();
      }
    } catch (e) {
      this.log.error('schedulePreCallReminders failed', e);
    }
  }
}
