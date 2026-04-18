import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { PipelineService } from '../pipeline/pipeline.service';
import { ActivitiesService } from '../activities/activities.service';
import { PipelineStage } from '../pipeline/schemas/pipeline-stage.schema';

const DIM_MAX = {
  capital: 25,
  experience: 20,
  location: 10,
  property: 20,
  motivation: 10,
  intent: 15,
} as const;

const TRACKS = ['Franchise Ready', 'Recruitment Only', 'Not Ready'] as const;
type CmsTrack = (typeof TRACKS)[number];

const SYSTEM_INSTRUCTION = `You are an expert analyst for a franchise consulting CRM (F&B and multi-unit operators in India and similar markets).

You receive a VOICE CALL SUMMARY and (optionally) a call TRANSCRIPT. Your job is to:
1) Score the prospect on six dimensions (same rubric as the in-app franchise readiness scorecard) with these exact MAXIMUM points — do not exceed them:
   - capital: 0–25 (investable capital, liquidity, funding comfort)
   - experience: 0–20 (relevant operating / F&B / business experience)
   - location: 0–10 (tier / market fit; infer from any city/region named)
   - property: 0–20 (site, access to space, or realistic path to a location)
   - motivation: 0–10 (seriousness, follow-through, energy)
   - intent: 0–15 (buying/ exploration intent: active > mid > exploring)
2) Set readinessBand to exactly one of: "franchise_ready", "recruitment_only", "not_ready" (lowercase, underscores).
3) Set suggestedTrack to exactly one of: "Franchise Ready", "Recruitment Only", "Not Ready".

CRITICAL INCLUSION RULE (must follow):
- If you estimate there is **roughly 20% or higher** subjective probability that this prospect could realistically move toward a franchise **investment or serious franchise discussion** (capital, fit, or intent, even if early), you MUST choose readinessBand "franchise_ready" and suggestedTrack "Franchise Ready" — not "Recruitment Only" and not "Not Ready".
- When in doubt between "Recruitment Only" and "Franchise Ready", **prefer "Franchise Ready"** whenever *any* credible path to franchise investment exists, even if information is thin.
- Use "Recruitment Only" only when the person is clearly job-seeking / employment-only / not an investor and not exploring owning a business.
- Use "Not Ready" when they are a clear **no** (abusive, impossible fit, or explicitly not interested in business ownership), or there is no usable signal; do not over-use this bucket.

Set intentSignal to one of: "active", "mid", "exploring" based on urgency.

suggestedStageName: optional. Prefer a stage that exists on the track: 
- Not Ready: Gap Nurture, Not Early, Discovery Call, Convert to Consulting
- Franchise Ready: Discovery Booked, Reminders Sent, Proposal Sent, Signed
- Recruitment Only: Routed to Eden
If unsure, OMIT suggestedStageName (we will use the first stage in that track).

Return **only** valid minified JSON with this shape (no markdown fences, no extra keys):
{
  "dimensions": { "capital": number, "experience": number, "location": number, "property": number, "motivation": number, "intent": number },
  "readinessBand": "franchise_ready" | "recruitment_only" | "not_ready",
  "suggestedTrack": "Franchise Ready" | "Recruitment Only" | "Not Ready",
  "suggestedStageName": string | null,
  "scorecardHighlights": { "key": "short value" },
  "intentSignal": "active" | "mid" | "exploring",
  "notesForCrm": "1–3 sentences for the team"
}
`;

type GeminiRow = {
  dimensions?: Record<string, number>;
  readinessBand?: string;
  suggestedTrack?: string;
  suggestedStageName?: string | null;
  scorecardHighlights?: Record<string, string>;
  intentSignal?: string;
  notesForCrm?: string;
};

@Injectable()
export class GeminiVoiceScoringService {
  private readonly log = new Logger(GeminiVoiceScoringService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly pipeline: PipelineService,
    private readonly activities: ActivitiesService,
  ) {}

  /**
   * After a voice call has a non-empty summary, uses Gemini to infer scorecard dimensions,
   * readiness band, track, and pipeline stage; updates the lead. Idempotent per voice call row
   * via `geminiScorecardAt`.
   */
  async applyFromVoiceEnrichment(
    leadId: string,
    vaaniCallId: string,
    options?: { skipIfNotInterested?: boolean },
  ): Promise<'skipped' | 'applied' | 'failed'> {
    const apiKey = this.config.get<string>('geminiApiKey')?.trim();
    if (!apiKey) {
      return 'skipped';
    }

    if (options?.skipIfNotInterested) {
      return 'skipped';
    }

    try {
      const lead = await this.leadModel
        .findById(leadId)
        .lean<(Lead & { _id: Types.ObjectId }) | null>()
        .exec();
      if (!lead) return 'skipped';

      const vc = lead.voiceCalls?.find((c) => c.vaaniCallId === vaaniCallId);
      if (!vc?.summary?.trim()) {
        return 'skipped';
      }
      if (vc.geminiScorecardAt) {
        return 'skipped';
      }

      const modelName =
        this.config.get<string>('geminiModel')?.trim() || 'gemini-2.0-flash';
      const gen = new GoogleGenerativeAI(apiKey);
      const model = gen.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const userBlock = this.buildUserContent(lead.name, vc.summary, vc.transcript ?? '');

      const r = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: userBlock }] },
        ],
      });
      const raw = (r.response.text() || '').trim();
      const parsed = this.parseJson(raw) as GeminiRow;
      if (!this.validateRow(parsed)) {
        this.log.warn('Gemini returned invalid scorecard row');
        return 'failed';
      }

      const dim = this.clampDimensions(parsed.dimensions!);
      const total = Object.values(dim).reduce((a, b) => a + b, 0);
      const band = parsed.readinessBand as
        | 'franchise_ready'
        | 'recruitment_only'
        | 'not_ready';
      const fromLabel = this.normalizeTrack(parsed.suggestedTrack!);
      const track: CmsTrack =
        fromLabel !== 'Not Ready' ? fromLabel : this.trackFromReadinessBand(band);
      const readiness = this.readinessFromTrack(track);
      const stage = await this.resolveStage(track, parsed.suggestedStageName);
      if (!stage) {
        this.log.warn(`No pipeline stage for track ${track}`);
        return 'failed';
      }

      const existing = (lead.scorecardData as Record<string, unknown> | undefined) ?? {};
      const scorecardData: Record<string, unknown> = {
        ...existing,
        voiceCallInference: {
          source: 'gemini_voice',
          at: new Date().toISOString(),
          model: modelName,
          voiceCallId: vaaniCallId,
          notes: parsed.notesForCrm?.slice(0, 2000) ?? '',
          highlights: parsed.scorecardHighlights ?? {},
          dimensions: dim,
          total,
        },
      };

      const scoreDimensions = [
        { name: 'Capital', score: dim.capital, max: 25 },
        { name: 'Experience', score: dim.experience, max: 20 },
        { name: 'Location', score: dim.location, max: 10 },
        { name: 'Property', score: dim.property, max: 20 },
        { name: 'Motivation', score: dim.motivation, max: 10 },
        { name: 'Intent', score: dim.intent, max: 15 },
      ];

      const intent = parsed.intentSignal;
      const intentOk =
        intent === 'active' || intent === 'mid' || intent === 'exploring' ? intent : 'mid';

      await this.leadModel.updateOne(
        { _id: leadId, 'voiceCalls.vaaniCallId': vaaniCallId },
        {
          $set: {
            track,
            stage: stage.name,
            pipelineStageId: new Types.ObjectId(String(stage._id)),
            score: total,
            totalScore: total,
            readinessBand: readiness,
            scoringCompletedAt: new Date(),
            scoreDimensions,
            scorecardData,
            intentSignal: intentOk,
            'voiceCalls.$[vc].geminiScorecardAt': new Date(),
          },
        },
        { arrayFilters: [{ 'vc.vaaniCallId': vaaniCallId }] },
      );

      await this.activities.logVoiceCall(
        leadId,
        lead.name,
        `Scorecard + track updated from voice (Gemini): ${track} — ${stage.name}. ${parsed.notesForCrm?.slice(0, 200) ?? ''}`.replace(
          /\s+/g,
          ' ',
        ),
      );
      return 'applied';
    } catch (e) {
      this.log.error('Gemini voice scoring failed', e);
      return 'failed';
    }
  }

  private buildUserContent(name: string, summary: string, transcript: string): string {
    const t = transcript.length > 50_000 ? `${transcript.slice(0, 50_000)}\n…(truncated)` : transcript;
    return `Lead name: ${name}

## Call summary
${summary}

## Transcript
${t.trim() || '(not provided)'}
`.trim();
  }

  private parseJson(raw: string): unknown {
    let s = raw;
    if (s.startsWith('```')) {
      s = s.replace(/^```[a-zA-Z]*\s*/m, '').replace(/```\s*$/m, '');
    }
    return JSON.parse(s) as unknown;
  }

  private validateRow(p: unknown): p is GeminiRow {
    if (!p || typeof p !== 'object') return false;
    const o = p as GeminiRow;
    if (!o.dimensions || typeof o.dimensions !== 'object') return false;
    for (const k of Object.keys(DIM_MAX) as (keyof typeof DIM_MAX)[]) {
      const n = (o.dimensions as Record<string, unknown>)[k];
      if (typeof n !== 'number' || !Number.isFinite(n)) return false;
    }
    if (
      o.readinessBand !== 'franchise_ready' &&
      o.readinessBand !== 'recruitment_only' &&
      o.readinessBand !== 'not_ready'
    ) {
      return false;
    }
    if (!o.suggestedTrack) return false;
    return true;
  }

  private clampDimensions(
    d: NonNullable<GeminiRow['dimensions']>,
  ): {
    capital: number;
    experience: number;
    location: number;
    property: number;
    motivation: number;
    intent: number;
  } {
    return {
      capital: this.clamp(d.capital, DIM_MAX.capital),
      experience: this.clamp(d.experience, DIM_MAX.experience),
      location: this.clamp(d.location, DIM_MAX.location),
      property: this.clamp(d.property, DIM_MAX.property),
      motivation: this.clamp(d.motivation, DIM_MAX.motivation),
      intent: this.clamp(d.intent, DIM_MAX.intent),
    };
  }

  private clamp(n: number, max: number, min = 0): number {
    return Math.max(min, Math.min(max, Math.round(Number(n) || 0)));
  }

  private normalizeTrack(s: string): CmsTrack {
    const t = s.trim();
    for (const x of TRACKS) {
      if (t.toLowerCase() === x.toLowerCase()) return x;
    }
    return 'Not Ready';
  }

  private trackFromReadinessBand(
    b: 'franchise_ready' | 'recruitment_only' | 'not_ready',
  ): CmsTrack {
    if (b === 'franchise_ready') return 'Franchise Ready';
    if (b === 'recruitment_only') return 'Recruitment Only';
    return 'Not Ready';
  }

  private readinessFromTrack(
    track: CmsTrack,
  ): 'franchise_ready' | 'recruitment_only' | 'not_ready' {
    if (track === 'Franchise Ready') return 'franchise_ready';
    if (track === 'Recruitment Only') return 'recruitment_only';
    return 'not_ready';
  }

  private async resolveStage(
    track: CmsTrack,
    name: string | null | undefined,
  ): Promise<(PipelineStage & { _id: string }) | null> {
    if (name?.trim()) {
      const byName = await this.pipeline.findStageByTrackAndName(track, name.trim());
      if (byName) return byName;
    }
    return this.pipeline.findFirstStageForTrack(track);
  }
}
