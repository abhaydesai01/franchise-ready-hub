import { verifyWebhookSignature } from '@/lib/whatsapp';
import { handleInboundMessage } from '@/lib/bot/conversationEngine';
import type { InboundMessageInput } from '@/lib/bot/inboundTypes';
import { connectDB } from '@/lib/mongodb';
import { AutomationLog } from '@/models/AutomationLog';
import { WebhookEvent } from '@/models/WebhookEvent';

type WaMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
};

type WaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
};

function extractMessages(body: unknown): InboundMessageInput[] {
  const out: InboundMessageInput[] = [];
  const root = body as {
    entry?: Array<{ changes?: Array<{ value?: { messages?: WaMessage[]; statuses?: WaStatus[] } }> }>;
  };
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages;
      if (!messages) continue;
      for (const m of messages) {
        const from = String(m.from ?? '');
        const messageId = String(m.id ?? '');
        const timestamp = String(m.timestamp ?? '');
        const type = String(m.type ?? 'text');
        if (type === 'text') {
          out.push({
            from,
            messageId,
            type,
            text: m.text?.body,
            timestamp,
          });
        } else if (type === 'interactive' && m.interactive) {
          const ir = m.interactive;
          if (ir.type === 'button_reply' && ir.button_reply) {
            out.push({
              from,
              messageId,
              type: 'interactive',
              buttonId: ir.button_reply.id,
              buttonTitle: ir.button_reply.title,
              timestamp,
            });
          } else if (ir.type === 'list_reply' && ir.list_reply) {
            out.push({
              from,
              messageId,
              type: 'interactive',
              listReplyId: ir.list_reply.id,
              buttonTitle: ir.list_reply.title,
              timestamp,
            });
          }
        } else if (type === 'button') {
          out.push({
            from,
            messageId,
            type: 'button',
            text: m.text?.body,
            timestamp,
          });
        }
      }
    }
  }
  return out;
}

function extractStatuses(body: unknown): WaStatus[] {
  const out: WaStatus[] = [];
  const root = body as {
    entry?: Array<{ changes?: Array<{ value?: { statuses?: WaStatus[] } }> }>;
  };
  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        out.push(s);
      }
    }
  }
  return out;
}

async function applyStatusUpdate(s: WaStatus) {
  const waMessageId = s.id;
  if (!waMessageId) return;
  const st = (s.status ?? '').toLowerCase();
  try {
    await connectDB();
    const update: Record<string, unknown> = {};
    if (st === 'sent') update.status = 'sent';
    if (st === 'delivered') {
      update.status = 'delivered';
      update.deliveredAt = new Date(Number(s.timestamp ?? Date.now()) * 1000);
    }
    if (st === 'read') {
      update.status = 'read';
      update.readAt = new Date(Number(s.timestamp ?? Date.now()) * 1000);
    }
    if (st === 'failed') update.status = 'failed';
    if (Object.keys(update).length === 0) return;
    await AutomationLog.updateOne({ waMessageId }, { $set: update });
  } catch (e) {
    console.error('[whatsapp webhook] status update failed', e);
  }
}

export async function processWhatsAppPayload(raw: string, signatureHeader: string | null): Promise<boolean> {
  if (!verifyWebhookSignature(raw, signatureHeader)) return false;
  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return true;
  }
  void (async () => {
    try {
      await connectDB();
      for (const msg of extractMessages(body)) {
        const eventKey = `whatsapp:message:${msg.messageId}`;
        if (!msg.messageId) continue;
        const existing = await WebhookEvent.findOne({ eventKey }).lean();
        if (existing?.status === 'processed') continue;
        await WebhookEvent.updateOne(
          { eventKey },
          {
            $setOnInsert: {
              source: 'whatsapp',
              payload: msg,
              status: 'received',
              attempts: 0,
            },
          },
          { upsert: true },
        );
        await WebhookEvent.updateOne(
          { eventKey },
          { $set: { status: 'processing' }, $inc: { attempts: 1 } },
        );
        await handleInboundMessage(msg);
        await WebhookEvent.updateOne(
          { eventKey },
          { $set: { status: 'processed', processedAt: new Date() } },
        );
      }
      for (const st of extractStatuses(body)) {
        const eventKey = `whatsapp:status:${st.id ?? 'unknown'}:${st.status ?? 'unknown'}:${st.timestamp ?? '0'}`;
        const existing = await WebhookEvent.findOne({ eventKey }).lean();
        if (existing?.status === 'processed') continue;
        await WebhookEvent.updateOne(
          { eventKey },
          {
            $setOnInsert: {
              source: 'whatsapp',
              payload: st,
              status: 'received',
              attempts: 0,
            },
          },
          { upsert: true },
        );
        await WebhookEvent.updateOne(
          { eventKey },
          { $set: { status: 'processing' }, $inc: { attempts: 1 } },
        );
        await applyStatusUpdate(st);
        await WebhookEvent.updateOne(
          { eventKey },
          { $set: { status: 'processed', processedAt: new Date() } },
        );
      }
    } catch (e) {
      try {
        await connectDB();
        await WebhookEvent.create({
          source: 'whatsapp',
          eventKey: `whatsapp:error:${Date.now()}`,
          status: 'failed',
          payload: { rawSnippet: raw.slice(0, 5000) },
          error: e instanceof Error ? e.message : String(e),
          attempts: 1,
        });
      } catch {
        // no-op
      }
      console.error('[whatsapp webhook] async processing error', e);
    }
  })();
  return true;
}
