import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Queue } from 'bullmq';
import { getSingletonBullConnection } from '../queues/redis-connection';

const WA_INACTIVITY_DELAY_MS = 10 * 60 * 1000; // 10 minutes

// Freddy v2 uses intent-based state (lastIntent field). These labels are used
// to drive the WhatsApp Inbox page.
const V2_STATE_LABELS: Record<string, string> = {
  greeting: 'Greeting',
  provide_name: 'Collecting name',
  provide_email: 'Collecting email',
  provide_phone: 'Collecting phone',
  passive_scoring_signal: 'Scoring signal',
  signal_ready_to_book: 'Ready to book',
  prefer_voice: 'Voice preferred',
  prefer_email: 'Email preferred',
  investor_intent: 'Investor lead',
  frustration_signal: 'Frustrated',
  confirm_booking: 'Booked',
  opt_out: 'Opted out',
  out_of_scope: 'Out of scope',
};

export interface InboxConversation {
  sessionId: string;
  phone: string;
  leadId: string | null;
  leadName: string;
  state: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageDirection: 'inbound' | 'outbound';
  isActive: boolean;
  totalMessages: number;
  createdAt: string;
}

export interface FreddyMessage {
  id: string;
  leadId: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  body: string;
  botState: string;
  timestamp: string;
}

@Injectable()
export class WhatsappInboxService {
  private readonly log = new Logger(WhatsappInboxService.name);

  constructor(@InjectConnection() private readonly conn: Connection) {}

  private botSessions() {
    return this.conn.db!.collection('botsessions');
  }
  private conversations() {
    return this.conn.db!.collection('conversations');
  }
  private leads() {
    return this.conn.db!.collection('leads');
  }

  async getInbox(): Promise<InboxConversation[]> {
    const sessions = await this.botSessions()
      .find({})
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();

    if (!sessions.length) return [];

    const phones = sessions.map((s) => String(s.phone ?? ''));
    const conversationIds = sessions
      .map((s) => s.conversationId)
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    const conversations = await this.conversations()
      .find({ _id: { $in: conversationIds } })
      .project({ _id: 1, messages: 1 })
      .toArray();

    const convoById = new Map<string, { messages: Array<Record<string, unknown>> }>();
    for (const c of conversations) {
      convoById.set(String(c._id), {
        messages: (c.messages as Array<Record<string, unknown>>) ?? [],
      });
    }

    const allVariants = phones.flatMap((p) => this._phoneVariants(p));
    const leadsArr = await this.leads()
      .find({ phone: { $in: allVariants } })
      .project({ _id: 1, name: 1, phone: 1 })
      .toArray();

    const leadByPhone = new Map<string, { id: string; name: string }>();
    for (const l of leadsArr) {
      const norm = this._normalizePhone(String(l.phone ?? ''));
      leadByPhone.set(norm, { id: String(l._id), name: String(l.name ?? '') });
    }

    return sessions.map((s) => {
      const phone = String(s.phone ?? '');
      const convo = s.conversationId ? convoById.get(String(s.conversationId)) : undefined;
      const lastMsg = convo?.messages?.[convo.messages.length - 1];
      const leadInfo = leadByPhone.get(this._normalizePhone(phone));
      const sessionLeadId = s.leadId ? String(s.leadId) : null;
      const lastIntent = String(s.lastIntent ?? '');
      const state = lastIntent || 'greeting';

      return {
        sessionId: String(s._id),
        phone,
        leadId: sessionLeadId ?? leadInfo?.id ?? null,
        leadName:
          leadInfo?.name && leadInfo.name !== 'WhatsApp lead'
            ? leadInfo.name
            : String(s.collectedName ?? '') || leadInfo?.name || 'Unknown',
        state,
        lastMessage: lastMsg ? String(lastMsg.text ?? '').slice(0, 120) : '',
        lastMessageAt: lastMsg?.createdAt
          ? new Date(lastMsg.createdAt as Date).toISOString()
          : new Date((s.lastMessageAt ?? s.updatedAt ?? s.createdAt) as Date).toISOString(),
        lastMessageDirection:
          ((lastMsg?.role === 'assistant' ? 'outbound' : 'inbound') as 'inbound' | 'outbound'),
        isActive: !s.optedOut && state !== 'confirm_booking' && state !== 'opt_out',
        totalMessages: convo?.messages?.length ?? 0,
        createdAt: new Date((s.createdAt ?? new Date()) as Date).toISOString(),
      };
    });
  }

  async getMessagesByLeadId(leadId: string): Promise<FreddyMessage[]> {
    const { Types } = await import('mongoose');
    let oid: InstanceType<typeof Types.ObjectId> | null = null;
    try { oid = new Types.ObjectId(leadId); } catch { return []; }

    const convo = await this.conversations().findOne({ leadId: oid });
    if (!convo) return [];

    const phone = String(convo.phone ?? '');
    const messages = (convo.messages as Array<Record<string, unknown>>) ?? [];

    return messages.map((m, idx) => ({
      id: `${String(convo._id)}_${idx}`,
      leadId,
      phone,
      direction: m.role === 'assistant' ? ('outbound' as const) : ('inbound' as const),
      body: String(m.text ?? ''),
      botState: String(m.intent ?? ''),
      timestamp: new Date((m.createdAt ?? Date.now()) as Date).toISOString(),
    }));
  }

  /**
   * Called by Freddy bot after each message.
   * Removes any existing inactivity job for this lead, then schedules a new one
   * with a fresh 10-minute delay. Uses a stable jobId so re-scheduling replaces.
   */
  async scheduleInactivityCall(params: {
    phone: string;
    leadId: string;
    state: string;
    session: Record<string, unknown>;
  }): Promise<void> {
    const { phone, leadId, state, session } = params;

    // States that should NOT trigger a call
    if (!leadId || state === 'confirm_booking' || state === 'opt_out') {
      return;
    }

    const knownName = String(session['collectedName'] ?? session['contact_name'] ?? '');
    const stateLabel = V2_STATE_LABELS[state] ?? state;
    const jobId = `wa_inactivity_${leadId}`;
    const jobData = {
      leadId,
      phone,
      state,
      knownName,
      collectedFields: stateLabel,
      missingFields: '',
    };

    let q: Queue | null = null;
    try {
      const conn = getSingletonBullConnection();
      q = new Queue('voice-fallback', { connection: conn });

      // Remove existing job first so the timer resets correctly
      const existing = await q.getJob(jobId);
      if (existing) {
        await existing.remove().catch(() => null);
      }

      await q.add('wa-inactivity-call', jobData, {
        delay: WA_INACTIVITY_DELAY_MS,
        jobId,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: true,
      });

      this.log.debug(`[wa-inactivity] Job scheduled for lead ${leadId} (state: ${state})`);
    } catch (e) {
      this.log.error('[wa-inactivity] Failed to schedule inactivity call', e);
    } finally {
      if (q) await q.close();
    }
  }

  private _normalizePhone(p: string): string {
    return p.replace(/\D/g, '');
  }

  private _phoneVariants(phone: string): string[] {
    const digits = this._normalizePhone(phone);
    const variants = new Set([phone, digits, `+${digits}`]);
    if (digits.startsWith('91') && digits.length === 12) variants.add(digits.slice(2));
    return Array.from(variants);
  }
}
