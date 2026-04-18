import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { computeGapAreas } from '../scorecard/scorecard-gaps';
import type { ScorecardDataPayload } from '../scorecard/scorecard.types';
import type { ScoreDimensionRow } from '../scorecard/scorecard.types';
import type { LeadBriefingResponse } from './briefing.types';

const BRIEFING_STAGES = new Set([
  'call_booked',
  'Discovery Booked',
  'Reminders Sent',
  'Proposal Sent',
  'Signed',
]);

function isBriefingEligible(lead: Lead & { _id?: unknown }): boolean {
  const dc = lead.discoveryCall;
  if (dc?.scheduledAt && dc.status !== 'cancelled') {
    return true;
  }
  const s = String(lead.stage ?? '');
  if (BRIEFING_STAGES.has(s)) return true;
  return false;
}

function normalizeDimensions(
  raw: Array<{ name: string; score: number; max: number }>,
): Array<{ label: string; score: number; max: number }> {
  const order = [
    { re: /capital/i, label: 'Capital' },
    { re: /experience/i, label: 'Business experience' },
    { re: /location/i, label: 'Location / market' },
    { re: /property/i, label: 'Property' },
    { re: /motivation/i, label: 'Motivation' },
    { re: /intent/i, label: 'Intent / timeline' },
  ];

  const rows: Array<{ label: string; score: number; max: number }> = [];
  for (const o of order) {
    const hit = raw.find((d) => o.re.test(d.name ?? ''));
    if (hit) {
      rows.push({
        label: o.label,
        score: hit.score,
        max: hit.max,
      });
    }
  }
  if (rows.length) return rows;

  return raw.map((d) => ({
    label: d.name,
    score: d.score,
    max: d.max,
  }));
}

function buildTalkTrack(input: {
  readinessBand: string | null | undefined;
  intentSignal: string | null | undefined;
  topGapTitle: string | null;
}): string {
  const band = String(input.readinessBand ?? '').toLowerCase();
  const intent = String(input.intentSignal ?? 'exploring').toLowerCase();
  const gap = input.topGapTitle ?? 'your biggest constraint';

  if (band === 'franchise_ready') {
    if (intent === 'active') {
      return (
        "This lead is highly motivated and financially prepared. Open by validating their score, then move quickly to scope and timeline. Key question: What's holding them back from deciding today?"
      );
    }
    if (intent === 'exploring' || intent === 'mid') {
      return (
        'Strong profile but not urgent. Focus on building excitement around the opportunity. Use the brand story. Key question: What would need to be true for you to move forward in the next 90 days?'
      );
    }
    return (
      'Strong profile but not urgent. Focus on building excitement around the opportunity. Use the brand story. Key question: What would need to be true for you to move forward in the next 90 days?'
    );
  }

  if (band === 'recruitment_only') {
    return (
      "Lead has the tools but needs franchise leads. Lead with ROI of your recruitment service. Key question: How many franchise leads are you currently generating per month?"
    );
  }

  return (
    `This is a nurture conversation, not a closing call. Be consultative. Identify the top 1–2 gaps and offer a roadmap. Key question: What's your plan to address ${gap} in the next 6 months?`
  );
}

@Injectable()
export class BriefingService {
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly usersService: UsersService,
  ) {}

  assertBriefingEligible(lead: Lead & { _id?: unknown }): void {
    if (!isBriefingEligible(lead)) {
      throw new ForbiddenException(
        'Briefing is available once a discovery call is booked (stage call_booked or later).',
      );
    }
  }

  async getBriefing(
    id: string,
    user: CurrentUserPayload,
  ): Promise<LeadBriefingResponse> {
    const lead = await this.leadModel.findById(id).lean<LeadDocument | null>().exec();
    if (!lead) throw new NotFoundException('Lead not found');
    this.assertAccess(lead as unknown as Lead & { _id: string }, user);
    this.assertBriefingEligible(lead);
    return this.buildPayload(lead as Lead & { _id: Types.ObjectId; createdAt?: Date });
  }

  /** Used by precall email worker (no JWT). */
  async getBriefingPayloadByLeadId(leadId: string): Promise<LeadBriefingResponse | null> {
    const lead = await this.leadModel.findById(leadId).lean<LeadDocument | null>().exec();
    if (!lead) return null;
    if (!isBriefingEligible(lead)) return null;
    return this.buildPayload(lead as Lead & { _id: Types.ObjectId; createdAt?: Date });
  }

  private assertAccess(
    lead: Lead & { _id: string },
    user: CurrentUserPayload,
  ): void {
    if (user.role === 'admin' || user.role === 'manager') return;
    const oid = String(user._id);
    const ownerMatches =
      lead.ownerId &&
      (typeof lead.ownerId === 'string'
        ? lead.ownerId === oid
        : String(lead.ownerId) === oid);
    const legacyAssigned = !lead.ownerId && lead.assignedTo === user.name;
    if (!ownerMatches && !legacyAssigned) {
      throw new ForbiddenException('You do not have access to this lead');
    }
  }

  private async buildPayload(
    lead: Lead & { _id: Types.ObjectId; createdAt?: Date },
  ): Promise<LeadBriefingResponse> {
    const scorecardData = lead.scorecardData as ScorecardDataPayload | undefined;

    let dimensions: Array<{ label: string; score: number; max: number }>;
    let gapAreas: Array<{ title: string; description: string }>;

    if (scorecardData?.dimensions?.length) {
      dimensions = scorecardData.dimensions.map((d: ScoreDimensionRow) => ({
        label: d.label,
        score: d.score,
        max: d.max,
      }));
      gapAreas = scorecardData.gapAreas ?? [];
    } else {
      const raw = lead.scoreDimensions ?? [];
      dimensions = normalizeDimensions(raw);
      gapAreas = computeGapAreas(raw);
    }

    const totalScore =
      scorecardData?.totalScore ?? lead.totalScore ?? lead.score ?? null;
    const readinessBand =
      scorecardData?.readinessBand ?? lead.readinessBand ?? null;
    const intentSignal = lead.intentSignal ?? null;
    const scorecardPdfUrl =
      scorecardData?.scorecardPdfUrl ?? lead.scorecardPdfUrl ?? null;

    const topGap = gapAreas[0]?.title ?? null;
    const talkTrack = buildTalkTrack({
      readinessBand,
      intentSignal,
      topGapTitle: topGap,
    });

    const wa = await this.loadWhatsappBotMessages(String(lead._id));

    let consultantName: string | null = null;
    if (lead.ownerId) {
      try {
        const u = await this.usersService.findById(String(lead.ownerId));
        consultantName = u.name ?? null;
      } catch {
        consultantName = lead.assignedTo ?? null;
      }
    } else {
      consultantName = lead.assignedTo ?? null;
    }

    const dc = lead.discoveryCall;
    const metaBits: string[] = [];
    if (/meta/i.test(String(lead.source ?? ''))) {
      metaBits.push(String(lead.source));
    }
    if (lead.metaLeadId) metaBits.push(`Lead ID: ${lead.metaLeadId}`);
    if (lead.metaFormId) metaBits.push(`Form ID: ${lead.metaFormId}`);
    const metaAdSource = metaBits.length ? metaBits.join(' · ') : null;

    const created =
      lead.createdAt instanceof Date
        ? lead.createdAt
        : new Date(String(lead.createdAt ?? Date.now()));

    return {
      leadProfile: {
        name: lead.name,
        email: lead.email ?? null,
        phone: lead.phone ?? null,
        company: lead.company ?? null,
        metaAdSource,
        utmCampaign: lead.utmCampaign ?? null,
        createdAt: created.toISOString(),
      },
      scorecardSummary: {
        totalScore,
        readinessBand,
        intentSignal,
        dimensions,
        gapAreas,
        scorecardPdfUrl,
      },
      conversationSummary: wa,
      callDetails: {
        scheduledAt: dc?.scheduledAt
          ? new Date(dc.scheduledAt).toISOString()
          : null,
        meetingLink: dc?.meetingLink ?? null,
        consultantName,
      },
      talkTrack,
    };
  }

  private async loadWhatsappBotMessages(
    leadId: string,
  ): Promise<LeadBriefingResponse['conversationSummary']> {
    const db = this.connection.db;
    if (!db) return [];

    const oid = new Types.ObjectId(leadId);
    const col = db.collection('activities');

    const docs = await col
      .find({
        $or: [{ leadId: oid }, { leadId: leadId }],
        activityType: 'whatsapp',
      })
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    const chronological = docs.reverse();
    return chronological.map((d) => {
      const dir = d.direction === 'inbound' ? 'inbound' : 'outbound';
      const ts = d.timestamp instanceof Date ? d.timestamp : new Date(d.timestamp ?? Date.now());
      return {
        direction: dir,
        timestamp: ts.toISOString(),
        body: String(d.body ?? ''),
      };
    });
  }
}
