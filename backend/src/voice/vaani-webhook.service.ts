import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Queue } from 'bullmq';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { CalendarService } from '../calendar/calendar.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NurtureQueueService } from './nurture-queue.service';
import { SettingsService } from '../settings/settings.service';
import { getSingletonBullConnection } from '../queues/redis-connection';
import { extractSlotIndex, inferVoiceOutcome, type VoiceInferredOutcome } from './vaani-infer-outcome';
import { GeminiVoiceScoringService } from './gemini-voice-scoring.service';
import { VoicePipelineSyncService } from './voice-pipeline-sync.service';
import { VoiceAdHocCalendarService } from './voice-ad-hoc-calendar.service';

const MS_24H = 24 * 60 * 60 * 1000;

/** Vaani portal signs the raw JSON body with HMAC-SHA256 using the shared Secret. */
function verifyVaaniHmacSha256(
  secret: string,
  rawBody: Buffer,
  signatureHeader: string,
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  let got = signatureHeader.trim();
  if (got.toLowerCase().startsWith('sha256=')) {
    got = got.slice(7).trim();
  }
  const a = got.toLowerCase();
  const b = expected.toLowerCase();
  if (a.length !== b.length || !/^[0-9a-f]+$/i.test(a)) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

@Injectable()
export class VaaniWebhookService {
  private readonly log = new Logger(VaaniWebhookService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly config: ConfigService,
    private readonly calendar: CalendarService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
    private readonly nurtureQueue: NurtureQueueService,
    private readonly settings: SettingsService,
    private readonly geminiVoiceScoring: GeminiVoiceScoringService,
    private readonly voicePipelineSync: VoicePipelineSyncService,
    private readonly voiceAdHocCalendar: VoiceAdHocCalendarService,
  ) {}

  async handle(
    payload: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer,
  ): Promise<{ status: string }> {
    const secret = this.config.get<string>('vaaniWebhookSecret')?.trim();
    if (secret) {
      const vaaniSigRaw =
        headers['vaani-signature'] ?? headers['Vaani-Signature'];
      const vaaniSig = Array.isArray(vaaniSigRaw) ? vaaniSigRaw[0] : vaaniSigRaw;
      if (rawBody?.length && typeof vaaniSig === 'string' && vaaniSig.length > 0) {
        if (!verifyVaaniHmacSha256(secret, rawBody, vaaniSig)) {
          this.log.warn('Vaani webhook HMAC verification failed');
          return { status: 'ok' };
        }
      } else {
        const h =
          headers['x-vaani-webhook-secret'] ??
          headers['x-webhook-secret'] ??
          headers['x-vaani-signature'];
        const got = Array.isArray(h) ? h[0] : h;
        const bodySecret =
          typeof payload.secret === 'string' ? payload.secret : undefined;
        if (String(got ?? bodySecret ?? '') !== secret) {
          this.log.warn('Vaani webhook secret mismatch');
          return { status: 'ok' };
        }
      }
    }

    const event = String(
      payload.event ?? payload.type ?? payload['event_type'] ?? '',
    )
      .toLowerCase()
      .replace(/-/g, '_');
    const roomName = String(
      payload.room_name ?? payload.roomName ?? payload['room_id'] ?? '',
    ).trim();
    if (!roomName) {
      return { status: 'ok' };
    }

    const lead = await this.leadModel
      .findOne({ 'voiceCalls.vaaniCallId': roomName })
      .exec();
    if (!lead) {
      this.log.warn(`No lead for Vaani call ${roomName}`);
      return { status: 'ok' };
    }

    const leadId = String(lead._id);

    try {
      switch (event) {
        case 'call_ringing':
          await this.patchVoiceCall(leadId, roomName, { status: 'ringing' });
          break;
        case 'user_picked_up_at':
          await this.patchVoiceCall(leadId, roomName, { status: 'answered' });
          await this.activities.logVoiceCall(
            leadId,
            lead.name,
            'Lead answered the Vaani voice call',
          );
          break;
        case 'call_rejected':
          await this.patchVoiceCall(leadId, roomName, { status: 'rejected' });
          await this.scheduleRetryOrNurture(lead, 'rejected');
          break;
        case 'call_no_answer':
          await this.patchVoiceCall(leadId, roomName, { status: 'no_answer' });
          await this.scheduleRetryOrNurture(lead, 'no_answer');
          break;
        case 'call_failed':
          await this.patchVoiceCall(leadId, roomName, { status: 'failed' });
          await this.activities.logVoiceCall(
            leadId,
            lead.name,
            `Vaani call failed: ${String(payload.error ?? 'unknown')}`,
          );
          await this.scheduleRetryOrNurture(lead, 'failed');
          break;
        case 'call_ended': {
          const dur = this.durationSeconds(payload);
          await this.patchVoiceCall(leadId, roomName, {
            status: 'completed',
            duration: dur,
            completedAt: new Date(),
          });
          break;
        }
        case 'call_postprocessing':
          await this.handlePostProcessing(lead, roomName, payload);
          break;
        case 'human_transfer_initiated':
          await this.activities.logVoiceCall(
            leadId,
            lead.name,
            `Call transferred to human: ${String(payload.phone_number ?? '')}`,
          );
          break;
        default:
          this.log.debug(`Vaani event ignored: ${event}`);
      }
    } catch (e) {
      this.log.error(`Vaani webhook handler error (${event})`, e);
    }

    return { status: 'ok' };
  }

  private durationSeconds(payload: Record<string, unknown>): number {
    const raw = payload.call_duration ?? payload.duration;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    // Vaani may send ms
    return n > 10_000 ? Math.round(n / 1000) : Math.round(n);
  }

  private async patchVoiceCall(
    leadId: string,
    vaaniCallId: string,
    patch: Record<string, unknown>,
  ) {
    const $set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      $set[`voiceCalls.$[vc].${k}`] = v;
    }
    await this.leadModel.updateOne(
      { _id: leadId, 'voiceCalls.vaaniCallId': vaaniCallId },
      { $set },
      { arrayFilters: [{ 'vc.vaaniCallId': vaaniCallId }] },
    );
  }

  private async handlePostProcessing(
    lead: Lead & { _id: { toString: () => string } },
    roomName: string,
    payload: Record<string, unknown>,
  ) {
    const leadId = String(lead._id);
    const transcript = String(payload.transcript ?? '');
    const summary = String(payload.summary ?? '');
    const entities = (payload.entities ?? {}) as Record<string, unknown>;
    const recordingUrl = String(
      payload.recording_url ?? payload.recordingUrl ?? '',
    );
    const dur = this.durationSeconds(payload);

    await this.patchVoiceCall(leadId, roomName, {
      status: 'completed',
      duration: dur,
      transcript,
      summary,
      entities,
      recordingUrl,
      completedAt: new Date(),
    });

    await this.activities.logVoiceCall(
      leadId,
      lead.name,
      `Vaani call completed. Summary: ${summary.slice(0, 500)}`,
    );

    const outcome = inferVoiceOutcome(summary, entities) as VoiceInferredOutcome;
    await this.leadModel.updateOne(
      { _id: leadId, 'voiceCalls.vaaniCallId': roomName },
      { $set: { 'voiceCalls.$[vc].outcome': outcome } },
      { arrayFilters: [{ 'vc.vaaniCallId': roomName }] },
    );

    const slotIdx = extractSlotIndex(entities, summary);
    if (slotIdx != null) {
      await this.leadModel.updateOne(
        { _id: leadId, 'voiceCalls.vaaniCallId': roomName },
        { $set: { 'voiceCalls.$[vc].slotOfferedIndex': slotIdx } },
        { arrayFilters: [{ 'vc.vaaniCallId': roomName }] },
      );
    }

    switch (outcome) {
      case 'booked': {
        const cached = await this.calendar.getCachedVoiceSlots(leadId);
        const idx = slotIdx ?? 1;
        const chosen = cached?.[idx - 1];
        const email = (lead.email ?? '').trim();
        if (chosen && email) {
          try {
            await this.calendar.bookSlot({
              leadId,
              slotStartTime: new Date(chosen.startTime),
              slotEndTime: new Date(chosen.endTime),
              leadName: lead.name,
              leadEmail: email,
              leadPhone: lead.phone,
              bookedVia: 'crm_voice',
            });
          } catch (e) {
            this.log.warn('bookSlot from Vaani post-processing', e);
            await this.notifications.notifyAdminsAndManagers({
              type: 'voice_booking_failed',
              description: `Lead ${lead.name} chose a slot on Vaani but booking failed. Follow up manually.`,
              leadId,
            });
          }
        } else {
          await this.notifications.notifyAdminsAndManagers({
            type: 'voice_booking_manual',
            description: `Lead ${lead.name} agreed to book on Vaani but slot or email was missing. Follow up manually.`,
            leadId,
          });
        }
        break;
      }
      case 'callback_requested': {
        const when = this.extractCallbackTime(entities, summary);
        await this.leadModel.findByIdAndUpdate(leadId, {
          $set: { voiceCallbackAt: when ?? new Date(Date.now() + MS_24H) },
        });
        if (when && when.getTime() > Date.now()) {
          await this.scheduleCallbackJob(leadId, when.getTime() - Date.now());
        } else {
          await this.scheduleCallbackJob(leadId, MS_24H);
        }
        break;
      }
      case 'not_interested':
        await this.leadModel.findByIdAndUpdate(leadId, {
          $set: { stage: 'not_interested', status: 'Dead' },
        });
        if (lead.phone) {
          await this.nurtureQueue.enqueue20DayDrip({
            leadId,
            phone: lead.phone,
            name: lead.name,
          });
        }
        break;
      default:
        break;
    }

    if (summary.trim().length > 0) {
      const g = await this.geminiVoiceScoring.applyFromVoiceEnrichment(leadId, roomName, {
        skipIfNotInterested: outcome === 'not_interested',
      });
      if (g === 'applied') {
        this.log.log(`Gemini scorecard applied (Vaani webhook) lead=${leadId}`);
      } else if (g === 'failed') {
        this.log.warn(`Gemini scorecard not applied for lead ${leadId} (see logs)`);
      }
    }

    await this.voicePipelineSync.afterVoiceDataSaved(leadId, roomName);
    await this.voiceAdHocCalendar.tryBookFromVoice(leadId, roomName);

    await this.notifications.notifyAdminsAndManagers({
      type: 'voice_call_completed',
      description: `Vaani — ${lead.name}: ${outcome}. ${dur}s. ${summary.slice(0, 280)}`,
      leadId,
    });
  }

  private extractCallbackTime(
    entities: Record<string, unknown>,
    summary: string,
  ): Date | null {
    const raw = entities.callback_time ?? entities.callbackTime;
    if (raw) {
      const d = new Date(String(raw));
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }

  private async scheduleRetryOrNurture(
    lead: Lead & { _id: { toString: () => string } },
    reason: string,
  ) {
    const leadId = String(lead._id);
    const settings = await this.settings.getSettings();
    const max = Math.min(5, Math.max(1, settings?.maxVoiceAttempts ?? 2));
    const attempts = (lead.voiceCalls?.length ?? 0);
    if (attempts < max) {
      await this.scheduleRetry24h(leadId);
      await this.activities.logVoiceCall(
        leadId,
        lead.name,
        `Vaani ${reason} — retry scheduled (~24h)`,
      );
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
      await this.activities.logVoiceCall(
        leadId,
        lead.name,
        'Moved to nurture after max Vaani attempts',
      );
    }
  }

  private async scheduleRetry24h(leadId: string) {
    try {
      const fresh = await this.leadModel.findById(leadId).exec();
      if (!fresh?.phone) return;
      const bot = fresh.botState ?? 'WARM_INTRO';
      const isSlot = bot === 'SLOT_OFFER';
      const triggerPoint = isSlot ? ('slot_offer' as const) : ('warm_intro' as const);
      const expectedBotState = isSlot
        ? ('SLOT_OFFER' as const)
        : ('WARM_INTRO' as const);
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

  private async scheduleCallbackJob(leadId: string, delayMs: number) {
    try {
      const fresh = await this.leadModel.findById(leadId).exec();
      if (!fresh?.phone) return;
      const bot = fresh.botState ?? 'WARM_INTRO';
      const isSlot = bot === 'SLOT_OFFER';
      const triggerPoint = isSlot ? ('slot_offer' as const) : ('warm_intro' as const);
      const expectedBotState = isSlot
        ? ('SLOT_OFFER' as const)
        : ('WARM_INTRO' as const);
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
      this.log.error('scheduleCallbackJob', e);
    }
  }
}
