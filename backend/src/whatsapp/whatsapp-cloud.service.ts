import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GRAPH_VERSION = 'v19.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function formatPhone(phone: string): string {
  const raw = phone.trim().replace(/^\+/, '');
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.startsWith('91')) return digits;
  return digits;
}

@Injectable()
export class WhatsappCloudService {
  private readonly log = new Logger(WhatsappCloudService.name);

  constructor(private readonly config: ConfigService) {}

  async sendText(toPhone: string, body: string): Promise<{ ok: boolean; error?: string }> {
    const phoneNumberId = this.config.get<string>('whatsappPhoneNumberId') ?? '';
    const token = this.config.get<string>('whatsappAccessToken') ?? '';
    if (!phoneNumberId || !token) {
      this.log.warn('WhatsApp not configured');
      return { ok: false, error: 'not_configured' };
    }
    const url = `${BASE}/${phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formatPhone(toPhone),
          type: 'text',
          text: { preview_url: true, body: body.slice(0, 4096) },
        }),
      });
      const json = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        return { ok: false, error: json.error?.message ?? res.statusText };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
