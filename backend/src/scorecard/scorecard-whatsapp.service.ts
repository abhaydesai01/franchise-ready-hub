import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';

const GRAPH_VERSION = 'v19.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Normalise to digits only, no +. Default India +91 for 10-digit local numbers. */
function formatPhone(phone: string): string {
  const raw = phone.trim().replace(/^\+/, '');
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.startsWith('91')) return digits;
  return digits;
}

@Injectable()
export class ScorecardWhatsappService {
  private readonly log = new Logger(ScorecardWhatsappService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPdfDocument(input: {
    toPhone: string;
    pdfBuffer: Buffer;
    fileName: string;
    caption: string;
  }): Promise<{ ok: boolean; messageId?: string; error?: string }> {
    const phoneNumberId = this.config.get<string>('whatsappPhoneNumberId') ?? '';
    const token = this.config.get<string>('whatsappAccessToken') ?? '';
    if (!phoneNumberId || !token) {
      this.log.warn('WhatsApp not configured — skipping scorecard document');
      return { ok: false, error: 'whatsapp_not_configured' };
    }

    const mediaId = await this.uploadMedia(phoneNumberId, token, input.pdfBuffer, input.fileName);
    if (!mediaId) {
      return { ok: false, error: 'media_upload_failed' };
    }

    const url = `${BASE}/${phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formatPhone(input.toPhone),
      type: 'document',
      document: {
        id: mediaId,
        caption: input.caption.slice(0, 1024),
        filename: input.fileName,
      },
    };

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
        this.log.error(`WA document send failed: ${err}`);
        return { ok: false, error: err };
      }
      return { ok: true, messageId: json.messages?.[0]?.id };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  }

  private async uploadMedia(
    phoneNumberId: string,
    token: string,
    buffer: Buffer,
    fileName: string,
  ): Promise<string | null> {
    const url = `${BASE}/${phoneNumberId}/media`;
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'application/pdf');
    form.append('file', buffer, { filename: fileName, contentType: 'application/pdf' });

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...form.getHeaders(),
        },
        body: form as unknown as BodyInit,
      });
      const json = (await res.json()) as { id?: string; error?: { message?: string } };
      if (!res.ok) {
        this.log.error(
          `WA media upload failed: ${json.error?.message ?? res.statusText}`,
        );
        return null;
      }
      return json.id ?? null;
    } catch (e) {
      this.log.error(`WA media upload exception: ${e}`);
      return null;
    }
  }
}
