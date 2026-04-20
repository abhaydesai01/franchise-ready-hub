import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Queue } from 'bullmq';
import { getSingletonBullConnection } from '../queues/redis-connection';

const WA_INACTIVITY_DELAY_MS = 10 * 60 * 1000; // 10 minutes

const FREDDY_STATE_FIELDS: Record<string, string> = {
  Q_NAME: 'Name',
  Q_EMAIL: 'Email',
  Q_BRAND: 'Brand / Business',
  Q_OUTLETS: 'No. of Outlets',
  Q_CITY: 'City',
  Q_SERVICE: 'Service Type',
  Q_SOPS: 'SOPs Ready',
  Q_GOAL: 'Growth Goal',
};

const FREDDY_SESSION_KEYS: Record<string, string> = {
  Q_NAME: 'contact_name',
  Q_EMAIL: 'email',
  Q_BRAND: 'brand_name',
  Q_OUTLETS: 'outlet_count',
  Q_CITY: 'city',
  Q_SERVICE: 'service_type',
  Q_SOPS: 'sops_ready',
  Q_GOAL: 'growth_goal',
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
  leadId: string | null;
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

  private sessions() {
    return this.conn.db!.collection('freddy_sessions');
  }
  private messages() {
    return this.conn.db!.collection('freddy_messages');
  }
  private leads() {
    return this.conn.db!.collection('leads');
  }

  async getInbox(): Promise<InboxConversation[]> {
    const sessions = await this.sessions()
      .find({})
      .sort({ updated_at: -1 })
      .limit(200)
      .toArray();

    if (!sessions.length) return [];

    const phones = sessions.map((s) => s.phone as string);

    const lastMsgs = await this.messages()
      .aggregate([
        { $match: { phone: { $in: phones } } },
        { $sort: { created_at: -1 } },
        {
          $group: {
            _id: '$phone',
            body: { $first: '$body' },
            direction: { $first: '$direction' },
            created_at: { $first: '$created_at' },
            total: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const msgMap = new Map(lastMsgs.map((m) => [m._id as string, m]));

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
      const msg = msgMap.get(phone);
      const leadInfo = leadByPhone.get(this._normalizePhone(phone));
      const sessionLeadId = s.lead_id ? String(s.lead_id) : null;

      return {
        sessionId: String(s._id),
        phone,
        leadId: sessionLeadId ?? leadInfo?.id ?? null,
        leadName: leadInfo?.name ?? (String(s.contact_name ?? '') || 'Unknown'),
        state: String(s.state ?? 'WELCOME'),
        lastMessage: msg ? String(msg.body ?? '').slice(0, 120) : '',
        lastMessageAt: msg?.created_at
          ? new Date(msg.created_at as Date).toISOString()
          : new Date((s.updated_at ?? s.created_at) as Date).toISOString(),
        lastMessageDirection: (msg?.direction as 'inbound' | 'outbound') ?? 'inbound',
        isActive: s.state !== 'DONE',
        totalMessages: Number(msg?.total ?? 0),
        createdAt: new Date(s.created_at as Date).toISOString(),
      };
    });
  }

  async getMessagesByLeadId(leadId: string): Promise<FreddyMessage[]> {
    const { Types } = await import('mongoose');
    let oid: InstanceType<typeof Types.ObjectId> | null = null;
    try { oid = new Types.ObjectId(leadId); } catch { return []; }

    const byLeadId = await this.messages()
      .find({ lead_id: oid })
      .sort({ created_at: 1 })
      .toArray();

    if (byLeadId.length) return byLeadId.map((d) => this._mapMsg(d));

    const lead = await this.leads().findOne({ _id: oid });
    if (!lead) return [];

    const variants = this._phoneVariants(String(lead.phone ?? ''));
    const byPhone = await this.messages()
      .find({ phone: { $in: variants } })
      .sort({ created_at: 1 })
      .toArray();

    return byPhone.map((d) => this._mapMsg(d));
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
    if (!leadId || state === 'DONE' || state === 'WELCOME' || state === 'SLOT_SELECT') {
      return;
    }

    // Build collected / missing field summaries
    const allStates = Object.keys(FREDDY_STATE_FIELDS);
    const collected: string[] = [];
    const missing: string[] = [];
    for (const st of allStates) {
      const key = FREDDY_SESSION_KEYS[st];
      if (session[key]) {
        collected.push(FREDDY_STATE_FIELDS[st]);
      } else {
        missing.push(FREDDY_STATE_FIELDS[st]);
      }
    }

    const knownName = String(session['contact_name'] ?? '');
    const jobId = `wa_inactivity_${leadId}`;
    const jobData = {
      leadId,
      phone,
      state,
      knownName,
      collectedFields: collected.join(', ') || 'none yet',
      missingFields: missing.join(', ') || 'all collected',
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

  private _mapMsg(d: Record<string, unknown>): FreddyMessage {
    return {
      id: String(d._id),
      leadId: d.lead_id ? String(d.lead_id) : null,
      phone: String(d.phone ?? ''),
      direction: (d.direction as 'inbound' | 'outbound') ?? 'inbound',
      body: String(d.body ?? ''),
      botState: String(d.bot_state ?? ''),
      timestamp: new Date(d.created_at as Date).toISOString(),
    };
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
