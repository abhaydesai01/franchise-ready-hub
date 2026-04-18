import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { SettingsService } from '../settings/settings.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { ActivitiesService } from '../activities/activities.service';
import { NurtureQueueService } from './nurture-queue.service';
import { getSingletonBullConnection } from '../queues/redis-connection';

const MS_24H = 24 * 60 * 60 * 1000;

type Disposition =
  | 'booked'
  | 'callback_requested'
  | 'not_interested'
  | 'no_answer'
  | 'failed'
  | 'unknown';

@Injectable()
export class VoiceWebhookService {
  private readonly log = new Logger(VoiceWebhookService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly settingsService: SettingsService,
    private readonly whatsapp: WhatsappCloudService,
    private readonly activities: ActivitiesService,
    private readonly nurtureQueue: NurtureQueueService,
    private readonly config: ConfigService,
  ) {}

  async handleEvent(raw: Record<string, unknown>): Promise<{ ok: true }> {
    const secret = this.config.get<string>('vapiWebhookSecret')?.trim();
    if (secret) {
      const got = raw['secret'] ?? raw['authorization'];
      if (String(got ?? '') !== secret) {
        this.log.warn('VAPI webhook secret mismatch');
        return { ok: true };
      }
    }

    const message = (raw.message ?? raw) as Record<string, unknown>;
    const msgType = String(message.type ?? raw.type ?? '').toLowerCase();

    const call = (message.call ?? raw.call ?? {}) as Record<string, unknown>;
    const metadata = (call.metadata ?? message.metadata ?? raw.metadata ?? {}) as {
      leadId?: string;
    };
    const leadId = metadata.leadId ? String(metadata.leadId) : '';

    const analysis = (message.analysis ?? {}) as {
      structuredData?: { disposition?: string; callbackAt?: string };
      summary?: string;
    };

    const structured = String(analysis.structuredData?.disposition ?? '').toLowerCase();
    const summary = String(analysis.summary ?? '').toLowerCase();
    const topDisposition = String(
      raw['disposition'] ?? message['disposition'] ?? '',
    ).toLowerCase();
    const combined = `${structured} ${summary} ${topDisposition}`;

    let disposition: Disposition = 'unknown';

    if (msgType.includes('no_answer') || msgType.includes('no-answer')) {
      disposition = 'no_answer';
    } else if (msgType.includes('call') && msgType.includes('fail')) {
      disposition = 'failed';
    } else if (combined.includes('book') || combined.includes('booked')) {
      disposition = 'booked';
    } else if (combined.includes('callback') || combined.includes('call back')) {
      disposition = 'callback_requested';
    } else if (
      combined.includes('not_interested') ||
      combined.includes('not interested')
    ) {
      disposition = 'not_interested';
    } else if (combined.includes('no answer') || combined.includes('no_answer')) {
      disposition = 'no_answer';
    } else if (combined.includes('fail')) {
      disposition = 'failed';
    }

    const isEnd =
      msgType.includes('end-of-call-report') ||
      msgType === 'call.completed' ||
      msgType.includes('call.completed');

    const terminalConnection =
      msgType.includes('no_answer') ||
      msgType.includes('no-answer') ||
      (msgType.includes('call') && msgType.includes('fail'));

    if (!leadId) {
      if (isEnd || terminalConnection) {
        this.log.debug('VAPI event without leadId in metadata; ignoring');
      }
      return { ok: true };
    }

    if (!isEnd && !terminalConnection && disposition === 'unknown') {
      return { ok: true };
    }

    const lead = await this.leadModel.findById(leadId).exec();
    if (!lead) return { ok: true };

    if (isEnd || terminalConnection || disposition !== 'unknown') {
      await this.logVoice(
        leadId,
        lead.name,
        `Voice outcome: ${disposition} (${msgType || 'event'})`,
      );
    }

    if (disposition === 'booked') {
      const calendly =
        (await this.settingsService.getSettings())?.calendlyLink?.trim() ||
        this.config.get<string>('calendlyLink')?.trim() ||
        '';
      if (lead.phone && calendly) {
        await this.whatsapp.sendText(
          lead.phone,
          `Here's your Calendly link to book your discovery call: ${calendly}`,
        );
      }
      await this.leadModel.findByIdAndUpdate(leadId, {
        $set: { stage: 'call_booked', voiceNoAnswerCount: 0 },
      });
      return { ok: true };
    }

    if (disposition === 'callback_requested') {
      const when = new Date(Date.now() + MS_24H);
      await this.leadModel.findByIdAndUpdate(leadId, {
        $set: { voiceCallbackAt: when },
      });
      await this.scheduleCallbackCall(leadId, when.getTime() - Date.now());
      return { ok: true };
    }

    if (disposition === 'not_interested') {
      await this.leadModel.findByIdAndUpdate(leadId, {
        $set: { stage: 'not_interested', status: 'Dead' },
      });
      return { ok: true };
    }

    if (disposition === 'no_answer' || disposition === 'failed') {
      const n = (lead.voiceNoAnswerCount ?? 0) + 1;
      await this.leadModel.findByIdAndUpdate(leadId, {
        $set: { voiceNoAnswerCount: n },
      });
      if (n < 2) {
        await this.scheduleRetry24h(leadId);
      } else {
        await this.leadModel.findByIdAndUpdate(leadId, {
          $set: { stage: 'Gap Nurture', track: 'Not Ready' },
        });
        if (lead.phone) {
          await this.nurtureQueue.enqueue20DayDrip({
            leadId,
            phone: lead.phone,
            name: lead.name,
          });
        }
      }
      return { ok: true };
    }

    return { ok: true };
  }

  private async logVoice(leadId: string, leadName: string, description: string) {
    await this.activities.logVoiceCall(leadId, leadName, description);
  }

  private async scheduleRetry24h(leadId: string) {
    try {
      const fresh = await this.leadModel.findById(leadId).exec();
      if (!fresh?.phone) return;

      const bot = fresh.botState ?? 'WARM_INTRO';
      const isSlot = bot === 'SLOT_OFFER';
      const triggerPoint = isSlot ? ('slot_offer' as const) : ('warm_intro' as const);
      const expectedBotState = isSlot ? ('SLOT_OFFER' as const) : ('WARM_INTRO' as const);

      const conn = getSingletonBullConnection();
      const q = new Queue('voice-fallback', { connection: conn });
      try {
        await q.add(
          'voice-fallback-retry',
          {
            leadId,
            phone: fresh.phone,
            name: fresh.name,
            expectedBotState,
            triggerPoint,
            attempt: 2,
          },
          {
            delay: MS_24H,
            jobId: `voice_fallback_retry_${leadId}`,
            attempts: 1,
          },
        );
      } finally {
        await q.close();
      }
    } catch (e) {
      this.log.error('scheduleRetry24h', e);
    }
  }

  private async scheduleCallbackCall(leadId: string, delayMs: number) {
    try {
      const fresh = await this.leadModel.findById(leadId).exec();
      if (!fresh?.phone) return;

      const bot = fresh.botState ?? 'WARM_INTRO';
      const isSlot = bot === 'SLOT_OFFER';
      const triggerPoint = isSlot ? ('slot_offer' as const) : ('warm_intro' as const);
      const expectedBotState = isSlot ? ('SLOT_OFFER' as const) : ('WARM_INTRO' as const);

      const conn = getSingletonBullConnection();
      const q = new Queue('voice-fallback', { connection: conn });
      try {
        await q.add(
          'voice-callback',
          {
            leadId,
            phone: fresh.phone,
            name: fresh.name,
            expectedBotState,
            triggerPoint,
            attempt: 1,
          },
          {
            delay: Math.max(60_000, delayMs),
            jobId: `voice_fallback_callback_${leadId}`,
            attempts: 1,
          },
        );
      } finally {
        await q.close();
      }
    } catch (e) {
      this.log.error('scheduleCallbackCall', e);
    }
  }
}
