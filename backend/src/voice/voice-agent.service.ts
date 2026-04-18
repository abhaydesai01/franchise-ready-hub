import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Lead } from '../leads/schemas/lead.schema';
import { SettingsService } from '../settings/settings.service';

export type VoiceTriggerPoint = 'intro_no_response' | 'slot_no_response';

function toE164(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length >= 10 && d.startsWith('91')) return `+${d}`;
  if (d.length === 10) return `+91${d}`;
  if (phone.trim().startsWith('+')) return phone.trim();
  return `+${d}`;
}

@Injectable()
export class VoiceAgentService {
  private readonly log = new Logger(VoiceAgentService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Start an outbound VAPI call. Configure assistant variables in the VAPI dashboard
   * (firstName, companyName, triggerPoint, readinessBand, totalScore, calendlyLink).
   */
  async initiateCall(
    lead: Lead & { _id: unknown },
    triggerPoint: VoiceTriggerPoint,
  ): Promise<{ ok: boolean; error?: string; callId?: string }> {
    const apiKey = this.config.get<string>('voiceApiKey')?.trim();
    const assistantId = this.config.get<string>('voiceAssistantId')?.trim();
    const phoneNumberId = this.config.get<string>('vapiPhoneNumberId')?.trim();
    if (!apiKey || !assistantId || !phoneNumberId) {
      this.log.error(
        'Missing VOICE_API_KEY, VOICE_ASSISTANT_ID, or VAPI_PHONE_NUMBER_ID',
      );
      return { ok: false, error: 'voice_not_configured' };
    }

    const phone = lead.phone?.trim();
    if (!phone) {
      return { ok: false, error: 'no_phone' };
    }

    const settings = await this.settingsService.getSettings();
    const branding = settings?.branding;
    const calendlyLink =
      settings?.calendlyLink?.trim() ||
      this.config.get<string>('calendlyLink')?.trim() ||
      '';

    const firstName = (lead.name ?? 'there').trim().split(/\s+/)[0] || 'there';
    const companyName =
      branding?.companyName?.trim() ||
      this.config.get<string>('companyName') ||
      'Franchise Ready';

    const totalScore = String(lead.totalScore ?? lead.score ?? '');
    const readinessBand = String(lead.readinessBand ?? '');

    const variableValues: Record<string, string> = {
      firstName,
      companyName,
      triggerPoint,
      calendlyLink,
      readinessBand,
      totalScore,
    };

    const leadId = String((lead as { _id: { toString: () => string } })._id);

    try {
      const res = await fetch('https://api.vapi.ai/call', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assistantId,
          phoneNumberId,
          customer: { number: toE164(phone) },
          assistantOverrides: {
            variableValues,
          },
          metadata: {
            leadId,
            triggerPoint,
            source: 'franchise-ready-crm',
          },
        }),
      });

      const json = (await res.json()) as { id?: string; message?: string[] };
      if (!res.ok) {
        const msg = Array.isArray(json.message)
          ? json.message.join('; ')
          : JSON.stringify(json);
        this.log.error(`VAPI error ${res.status}: ${msg}`);
        return { ok: false, error: msg };
      }
      return { ok: true, callId: json.id };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      this.log.error(`VAPI request failed: ${err}`);
      return { ok: false, error: err };
    }
  }
}
