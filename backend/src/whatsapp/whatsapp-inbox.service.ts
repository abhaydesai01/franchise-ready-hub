import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

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
  constructor(@InjectConnection() private readonly conn: Connection) {}

  private sessions() {
    return this.conn.db.collection('freddy_sessions');
  }
  private messages() {
    return this.conn.db.collection('freddy_messages');
  }
  private leads() {
    return this.conn.db.collection('leads');
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
        leadName: leadInfo?.name ?? String(s.contact_name ?? '') || 'Unknown',
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
