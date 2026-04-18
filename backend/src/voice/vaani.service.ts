import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AppSettings,
  SettingsDocument,
} from '../settings/schemas/settings.schema';

const VAANI_INTEGRATION_ID = 'i6';

export type VaaniTriggerReason = 'intro_no_response' | 'slot_no_response';

/** Result of POST /api/trigger-call/ — `callId` is the room name used by transcript, call_details, stream. */
export type VaaniTriggerResult = {
  callId: string;
  agentName: string;
  dispatchId?: string;
};

/**
 * Vaani may return `output` as a string, e.g.
 * "Dispatched agent x to room outbound-1776528767-abc (dispatch_id: AD_...)"
 * or as an object with `call_id`.
 */
export function parseTriggerCallResponse(data: unknown): VaaniTriggerResult {
  const d = data as Record<string, unknown> | null;
  if (!d) {
    throw new Error('Vaani: empty response');
  }
  const out = d['output'];
  if (out && typeof out === 'object') {
    const o = out as Record<string, unknown>;
    const cid = o['call_id'] ?? o['callId'] ?? o['room'] ?? o['room_name'];
    if (typeof cid === 'string' && cid.length > 0) {
      return {
        callId: cid,
        agentName: String(o['agent_name'] ?? o['agentName'] ?? ''),
        dispatchId: typeof o['dispatch_id'] === 'string' ? o['dispatch_id'] : undefined,
      };
    }
  }
  if (typeof out === 'string') {
    const s = out;
    const toRoom = s.match(/\bto room ([A-Za-z0-9_\-]+)/i);
    const room = toRoom?.[1];
    const disp = s.match(/dispatch_id:\s*([A-Za-z0-9_]+)/i);
    if (room) {
      return {
        callId: room,
        agentName: '',
        dispatchId: disp?.[1],
      };
    }
  }
  if (typeof d['call_id'] === 'string' && d['call_id'].length) {
    return { callId: d['call_id'], agentName: String(d['agent_name'] ?? '') };
  }
  if (typeof d['callId'] === 'string' && d['callId'].length) {
    return { callId: d['callId'], agentName: '' };
  }
  throw new Error(
    `Vaani call trigger: could not parse room / call_id from: ${JSON.stringify(d)}`,
  );
}

export type VaaniTranscriptResponse = {
  transcript?: string;
  status_code?: number;
  function?: string;
};

export type VaaniCallDetailsResponse = {
  transcription?: string;
  transcript?: string;
  entity?: Record<string, unknown>;
  entities?: Record<string, unknown>;
  conversation_eval?: Record<string, unknown> | null;
  summary?: string;
  call_eval_tag?: string | null;
  sentiment?: string;
};

@Injectable()
export class VaaniService {
  private readonly log = new Logger(VaaniService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel(AppSettings.name)
    private readonly settingsModel: Model<SettingsDocument>,
  ) {}

  /** Resolve credentials: env first, then Settings → Integrations (i6). */
  /** `outboundNumber` is optional — Vaani may use a default caller ID from the portal. */
  async getConfig(): Promise<{
    baseUrl: string;
    apiKey: string;
    agentId: string;
    outboundNumber: string;
  } | null> {
    const envKey = this.config.get<string>('vaaniApiKey')?.trim() ?? '';
    const envAgent = this.config.get<string>('vaaniAgentId')?.trim() ?? '';
    const envOut = this.config.get<string>('vaaniOutboundNumber')?.trim() ?? '';
    const baseUrl = (
      this.config.get<string>('vaaniBaseUrl')?.trim() ||
      'https://api.vaanivoice.ai'
    ).replace(/\/$/, '');

    let apiKey = envKey;
    let agentId = envAgent;
    let outboundNumber = envOut;

    if (!apiKey || !agentId || !outboundNumber) {
      try {
        const s = await this.settingsModel
          .findOne()
          .lean<
            (AppSettings & {
              _id: string;
              vaaniAgentId?: string;
              vaaniOutboundNumber?: string;
            }) | null
          >()
          .exec();
        const int = s?.integrations?.find((i) => i.id === VAANI_INTEGRATION_ID);
        const fromDbKey = String(int?.apiKey ?? '').trim();
        if (!apiKey && fromDbKey) apiKey = fromDbKey;
        if (!agentId && s?.vaaniAgentId?.trim()) agentId = s.vaaniAgentId.trim();
        if (!outboundNumber && s?.vaaniOutboundNumber?.trim()) {
          outboundNumber = s.vaaniOutboundNumber.trim();
        }
      } catch (e) {
        this.log.warn('getConfig settings read failed', e);
      }
    }

    if (!apiKey || !agentId) return null;

    return { baseUrl, apiKey, agentId, outboundNumber };
  }

  isConfigured(): Promise<boolean> {
    return this.getConfig().then((c) => !!c);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.getConfig();
    if (!cfg) {
      return {
        ok: false,
        message:
          'Set VAANI_API_KEY and VAANI_AGENT_ID (or save in Settings → Integrations). Outbound number is optional.',
      };
    }
    try {
      const res = await fetch(`${cfg.baseUrl}/`, {
        method: 'GET',
        headers: { 'X-API-Key': cfg.apiKey },
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: 'API key rejected (401/403).' };
      }
      return {
        ok: true,
        message: `Reachable (${res.status}). Key accepted for basic request.`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  }

  async triggerCall(params: {
    leadId: string;
    contactNumber: string;
    leadName: string;
    triggerReason: VaaniTriggerReason;
    readinessScore: number;
    readinessBand: string;
    availableSlots: string;
    companyName: string;
  }): Promise<VaaniTriggerResult> {
    const cfg = await this.getConfig();
    if (!cfg) {
      throw new Error('Vaani is not configured');
    }

    const body: Record<string, unknown> = {
      agent_id: cfg.agentId,
      contact_number: params.contactNumber,
      name: params.leadName,
      voice: '',
      metadata: {
        lead_id: params.leadId,
        lead_name: params.leadName,
        company_name: params.companyName,
        trigger_reason: params.triggerReason,
        readiness_score: String(params.readinessScore),
        readiness_band: params.readinessBand,
        available_slots: params.availableSlots,
      },
    };
    if (cfg.outboundNumber?.trim()) {
      body.outbound_number = cfg.outboundNumber.trim();
    }

    const res = await fetch(`${cfg.baseUrl}/api/trigger-call/`, {
      method: 'POST',
      headers: {
        'X-API-Key': cfg.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as unknown;

    if (!res.ok || (data as { success?: boolean })?.success === false) {
      throw new Error(
        `Vaani call trigger failed: ${res.status} ${JSON.stringify(data)}`,
      );
    }

    return parseTriggerCallResponse(data);
  }

  /** GET /api/transcript/{room} */
  async getTranscript(roomName: string): Promise<VaaniTranscriptResponse | null> {
    const cfg = await this.getConfig();
    if (!cfg) return null;
    const res = await fetch(
      `${cfg.baseUrl}/api/transcript/${encodeURIComponent(roomName)}`,
      { headers: { 'X-API-Key': cfg.apiKey } },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      this.log.warn(`getTranscript ${res.status} for ${roomName}`);
      return null;
    }
    return (await res.json().catch(() => ({}))) as VaaniTranscriptResponse;
  }

  /** GET /api/call_details/{room} */
  async getCallDetails(roomName: string): Promise<VaaniCallDetailsResponse | null> {
    const cfg = await this.getConfig();
    if (!cfg) return null;
    const res = await fetch(
      `${cfg.baseUrl}/api/call_details/${encodeURIComponent(roomName)}`,
      { headers: { 'X-API-Key': cfg.apiKey } },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      this.log.warn(`getCallDetails ${res.status} for ${roomName}`);
      return null;
    }
    return (await res.json().catch(() => ({}))) as VaaniCallDetailsResponse;
  }

  /**
   * Merges `call_details` + `transcript` in the same shape the CRM and Mongo `voiceCalls[]` use.
   * Vaani’s `entity` (singular) is stored as our `entities` object.
   */
  async fetchCallEnrichmentForRoom(
    roomName: string,
  ): Promise<{
    transcript: string;
    summary: string;
    entities: Record<string, unknown>;
    sentiment: string;
    callEvalTag: string;
    conversationEval: Record<string, unknown>;
  } | null> {
    const cfg = await this.getConfig();
    if (!cfg) return null;

    const [tSettled, dSettled] = await Promise.allSettled([
      this.getTranscript(roomName),
      this.getCallDetails(roomName),
    ]);
    if (tSettled.status === 'rejected') {
      this.log.warn(String(tSettled.reason));
    }
    if (dSettled.status === 'rejected') {
      this.log.warn(String(dSettled.reason));
    }
    const trRes = tSettled.status === 'fulfilled' ? tSettled.value : null;
    const detRes = dSettled.status === 'fulfilled' ? dSettled.value : null;

    if (!trRes && !detRes) return null;

    const tFromTr = (trRes?.transcript?.trim() ?? '') || '';
    const tFromDet =
      (typeof detRes?.transcription === 'string' && detRes.transcription.trim()
        ? detRes.transcription
        : (detRes as { transcript?: string })?.transcript?.trim?.() ?? '') || '';
    const transcript = (tFromDet || tFromTr).trim() || tFromTr;

    const entRaw = detRes?.entity ?? detRes?.entities;
    const entities: Record<string, unknown> =
      entRaw && typeof entRaw === 'object' && !Array.isArray(entRaw)
        ? (entRaw as Record<string, unknown>)
        : {};

    const cev = detRes?.conversation_eval;
    const conversationEval: Record<string, unknown> =
      cev && typeof cev === 'object' && cev !== null
        ? (cev as Record<string, unknown>)
        : {};

    return {
      transcript: transcript || '',
      summary: String(detRes?.summary ?? ''),
      entities,
      sentiment: String(
        (detRes as { sentiment?: string } | null)?.sentiment?.trim() ?? '',
      ),
      callEvalTag:
        detRes?.call_eval_tag == null
          ? ''
          : String(detRes.call_eval_tag).trim() || '',
      conversationEval,
    };
  }

  async getRecordingStreamUrl(callId: string): Promise<string | null> {
    const cfg = await this.getConfig();
    if (!cfg) return null;
    const res = await fetch(`${cfg.baseUrl}/api/stream/${encodeURIComponent(callId)}`, {
      headers: { 'X-API-Key': cfg.apiKey },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stream_url?: string };
    return data.stream_url ?? null;
  }
}
