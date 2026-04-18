import crypto from 'crypto';

const GRAPH_VERSION = 'v19.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export type SendResult = { messageId: string | null; success: boolean; error: string | null };

type MessagingPayload = Record<string, unknown>;

function getPhoneNumberId(): string {
  return process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
}

function getToken(): string {
  return process.env.WHATSAPP_ACCESS_TOKEN ?? '';
}

/** Normalise to digits only, no +. Default India +91 for 10-digit local numbers. */
export function formatPhone(phone: string): string {
  const raw = phone.trim().replace(/^\+/, '');
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.startsWith('91')) return digits;
  if (digits.length >= 12 && digits.startsWith('91')) return digits;
  return digits;
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signatureHeader, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function postMessages(body: MessagingPayload): Promise<SendResult> {
  const phoneNumberId = getPhoneNumberId();
  const token = getToken();
  if (!phoneNumberId || !token) {
    console.error('[whatsapp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN');
    return { messageId: null, success: false, error: 'WhatsApp not configured' };
  }
  const url = `${BASE}/${phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      const err = json.error?.message ?? res.statusText;
      console.error('[whatsapp] API error', res.status, err);
      return { messageId: null, success: false, error: err };
    }
    const id = json.messages?.[0]?.id ?? null;
    return { messageId: id, success: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[whatsapp] request failed', msg);
    return { messageId: null, success: false, error: msg };
  }
}

export async function sendWhatsAppMessage(
  to: string,
  payload: { type: 'text'; text: { body: string } } | { type: string; [key: string]: unknown },
): Promise<SendResult> {
  const recipient = formatPhone(to);
  const body: MessagingPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    ...payload,
  };
  return postMessages(body);
}

export async function sendText(to: string, text: string): Promise<SendResult> {
  return sendWhatsAppMessage(to, {
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

export async function sendTemplate(
  to: string,
  templateName: string,
  components: Record<string, unknown>[] | undefined,
  languageCode: string,
): Promise<SendResult> {
  return sendWhatsAppMessage(to, {
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components ?? [],
    },
  });
}

export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[],
): Promise<SendResult> {
  return sendWhatsAppMessage(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

export type ListSection = {
  title: string;
  rows: { id: string; title: string; description?: string }[];
};

export async function sendList(
  to: string,
  bodyText: string,
  buttonLabel: string,
  sections: ListSection[],
): Promise<SendResult> {
  return sendWhatsAppMessage(to, {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: sections.map((s) => ({
          title: s.title.slice(0, 24),
          rows: s.rows.map((r) => ({
            id: r.id,
            title: r.title.slice(0, 24),
            description: r.description?.slice(0, 72),
          })),
        })),
      },
    },
  });
}

/** Send a bot template (text or interactive) built in `lib/bot/templates.ts`. */
export async function sendBotTemplate(
  to: string,
  msg: { type: 'text'; text: string } | { type: 'interactive'; interactive: Record<string, unknown> },
): Promise<SendResult> {
  if (msg.type === 'text') {
    return sendText(to, msg.text);
  }
  return sendWhatsAppMessage(to, {
    type: 'interactive',
    interactive: msg.interactive,
  });
}
