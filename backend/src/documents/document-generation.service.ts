import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivitiesService } from '../activities/activities.service';
import { DocumentPdfService } from './document-pdf.service';
import { DocumentStorageService } from './document-storage.service';
import { computeGapAreas } from '../scorecard/scorecard-gaps';
import type { ScorecardDataPayload } from '../scorecard/scorecard.types';

const PROPOSAL_SYSTEM = `You are a senior franchise business consultant writing a professional engagement proposal for a consulting firm. Write in a confident, warm, and professional tone. Use Indian English. Format the output as structured sections with clear headings. Do not include any preamble — begin directly with the proposal content.`;

const MOM_SYSTEM = `You are a professional business consultant writing minutes of meeting for a franchise consulting firm. Be precise, factual, and structured. Use only the information provided — do not add assumptions. Write in third person.`;

function serviceTypeLabel(raw?: string): string {
  if (!raw) return 'Not provided';
  const m: Record<string, string> = {
    full_consulting: 'Full franchise consulting',
    recruitment_only: 'Recruitment only — already has franchise tools',
    needs_development: 'Needs development before franchising',
  };
  return m[raw] ?? raw;
}

function formatMomDate(scheduledAt?: Date): string {
  if (!scheduledAt) return '—';
  try {
    const d =
      scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

@Injectable()
export class DocumentGenerationService {
  private readonly log = new Logger(DocumentGenerationService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly config: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
    private readonly notifications: NotificationsService,
    private readonly activities: ActivitiesService,
    private readonly pdf: DocumentPdfService,
    private readonly storage: DocumentStorageService,
  ) {}

  /**
   * BullMQ worker entry — generate proposal or MOM from post-call notes + lead context.
   */
  async runGenerateJob(
    leadId: string,
    documentType: 'proposal' | 'mom',
  ): Promise<void> {
    const apiKey = this.config.get<string>('anthropicApiKey')?.trim();
    if (!apiKey) {
      this.log.error('ANTHROPIC_API_KEY not set — skip document generation');
      return;
    }

    const lead = await this.leadModel.findById(leadId).lean<LeadDocument | null>().exec();
    if (!lead) {
      this.log.warn(`Lead ${leadId} not found`);
      return;
    }

    const callNotes = (lead as Lead & { callNotes?: Record<string, unknown> }).callNotes;
    if (!callNotes?.submittedAt) {
      this.log.warn(`Lead ${leadId} has no submitted call notes`);
      return;
    }

    const app = await this.settingsService.getSettings();
    const companyName =
      app?.branding?.companyName?.trim() ||
      this.config.get<string>('companyName') ||
      'Franchise Ready';
    const letterheadLine2 =
      [app?.branding?.addressLine, app?.branding?.supportPhone]
        .filter(Boolean)
        .join(' · ') || undefined;

    const gapAreasStr = this.gapAreasJoined(lead);
    const scorecardAnswers = (lead.scorecardAnswers ?? {}) as Record<string, unknown>;

    const targetLocation =
      String(
        scorecardAnswers['targetLocation'] ??
          scorecardAnswers['targetLocationText'] ??
          'Not provided',
      ) || 'Not provided';

    let consultantName = lead.assignedTo ?? 'Consultant';
    if (lead.ownerId) {
      try {
        const u = await this.usersService.findById(String(lead.ownerId));
        consultantName = u.name ?? consultantName;
      } catch {
        // keep assignedTo
      }
    }

    const client = new Anthropic({ apiKey });
    const model = this.config.get<string>('anthropicModel') ?? 'claude-sonnet-4-20250514';

    let system: string;
    let userPrompt: string;
    let pdfTitle: string;

    if (documentType === 'proposal') {
      system = PROPOSAL_SYSTEM;
      userPrompt = this.buildProposalUserPrompt(lead, callNotes as Record<string, unknown>, {
        gapAreasStr,
        targetLocation,
      });
      pdfTitle = `Engagement Proposal — ${lead.name}`;
    } else {
      system = MOM_SYSTEM;
      userPrompt = this.buildMomUserPrompt(lead, callNotes as Record<string, unknown>, {
        consultantName,
        companyName,
        meetingDate: formatMomDate(lead.discoveryCall?.scheduledAt),
      });
      pdfTitle = `Minutes of Meeting — ${lead.name}`;
    }

    const text = await this.callAnthropic(client, model, system, userPrompt);
    const sections = this.pdf.parseSectionsFromModelText(text);

    const buffer = await this.pdf.buildDocumentPdf({
      title: pdfTitle,
      sections,
      companyName,
      letterheadLine2,
    });

    const { url } = await this.storage.saveDocumentPdf(
      leadId,
      documentType,
      buffer,
    );

    await this.leadModel.findByIdAndUpdate(leadId, {
      $push: {
        documents: {
          documentType,
          url,
          generatedAt: new Date(),
          status: 'pending_review',
        },
      },
    });

    const label = documentType === 'proposal' ? 'Proposal' : 'MOM';
    await this.activities.createForLead(leadId, {
      type: 'document_generated',
      description: `${label} generated — pending review.`,
      addedBy: 'System',
    });

    if (lead.ownerId) {
      await this.notifications.notifyUser({
        userId: String(lead.ownerId),
        type: 'document_ready_review',
        description: `Your ${label} for ${lead.name} is ready for review.`,
        leadId,
      });
    }

    this.log.log(`Generated ${documentType} for lead ${leadId} → ${url}`);
  }

  private gapAreasJoined(lead: Lead): string {
    const data = lead.scorecardData as ScorecardDataPayload | undefined;
    if (data?.gapAreas?.length) {
      return data.gapAreas.map((g) => g.title).join(', ');
    }
    const gaps = computeGapAreas(lead.scoreDimensions ?? []);
    return gaps.map((g) => g.title).join(', ') || '—';
  }

  private buildProposalUserPrompt(
    lead: Lead,
    callNotes: Record<string, unknown>,
    extra: { gapAreasStr: string; targetLocation: string },
  ): string {
    return `Generate a complete franchise consulting engagement proposal using the following information:
CLIENT INFORMATION:
Name: ${lead.name}
Company: ${lead.company ?? 'Not provided'}
Location: ${extra.targetLocation}
FRANCHISE READINESS ASSESSMENT:
Total Score: ${lead.totalScore ?? lead.score ?? '—'}/100
Readiness Band: ${lead.readinessBand ?? '—'}
Capital Band: ${String(scorecardAnswer(lead, 'capitalBand'))}
Business Experience: ${String(scorecardAnswer(lead, 'businessExperience'))}
Property Status: ${String(scorecardAnswer(lead, 'propertyStatus'))}
Intent Signal: ${lead.intentSignal ?? '—'}
Gap Areas: ${extra.gapAreasStr}
DISCOVERY CALL NOTES:
Service Type Agreed: ${serviceTypeLabel(String(callNotes.serviceType ?? ''))}
Engagement Scope: ${callNotes.engagementScope ?? '—'}
Price Discussed: ₹${callNotes.priceDiscussed != null ? String(callNotes.priceDiscussed) : 'To be confirmed'}
Objections Raised: ${callNotes.objections ? String(callNotes.objections) : 'None noted'}
Commitments Made: ${callNotes.commitments ? String(callNotes.commitments) : 'None'}
Additional Context: ${callNotes.consultantNotes ?? '—'}
Next Step Agreed: ${callNotes.nextStep ?? '—'}
Generate a proposal with these exact sections:

Executive Summary (2–3 paragraphs — who we are, why this engagement makes sense for this specific client based on their score and situation)
Franchise Readiness Assessment Summary (summarise their score, highlight strengths, acknowledge gaps, show how our programme addresses those gaps)
Scope of Engagement (detailed description of what we will deliver, based on the service type and engagement scope provided)
Investment & Timeline (present the price discussed, outline a realistic timeline in phases, if objections were raised address them here)
Why Now (urgency section based on their intent signal and market context)
Next Steps (numbered list of exactly what happens after they sign)
Terms & Validity (standard: proposal valid for 14 days, 50% advance to commence, remaining on milestone)`;
  }

  private buildMomUserPrompt(
    lead: Lead,
    callNotes: Record<string, unknown>,
    ctx: { consultantName: string; companyName: string; meetingDate: string },
  ): string {
    return `Generate Minutes of Meeting using the following information:
DATE: ${ctx.meetingDate}
ATTENDEES: ${lead.name} (Prospect), ${ctx.consultantName} (Franchise Consultant, ${ctx.companyName})
CONTEXT: Initial franchise discovery call.
DISCUSSION SUMMARY:
Engagement Scope Discussed: ${callNotes.engagementScope ?? '—'}
Service Type Discussed: ${serviceTypeLabel(String(callNotes.serviceType ?? ''))}
Price Discussed: ₹${callNotes.priceDiscussed != null ? String(callNotes.priceDiscussed) : 'Not discussed'}
Objections / Concerns Raised: ${callNotes.objections ? String(callNotes.objections) : 'None'}
Commitments Made by Consultant: ${callNotes.commitments ? String(callNotes.commitments) : 'None'}
Additional Notes: ${callNotes.consultantNotes ?? '—'}
Next Step Agreed: ${callNotes.nextStep ?? '—'}
Generate MOM with these exact sections:

Meeting Overview (date, attendees, purpose)
Key Discussion Points (bullet points of main topics covered)
Prospect's Current Situation (summarise based on scope and notes)
Services Discussed (what was presented and how)
Prospect's Questions and Concerns (from objections field)
Commitments and Action Items (two columns: Consultant Actions and Prospect Actions, with deadlines from nextStep)
Agreed Next Steps (numbered, with dates where mentioned)
Meeting Closure Statement`;
  }

  private async callAnthropic(
    client: Anthropic,
    model: string,
    system: string,
    userPrompt: string,
  ): Promise<string> {
    const res = await client.messages.create({
      model,
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = res.content[0];
    if (block.type !== 'text') {
      throw new Error('Unexpected Anthropic response block');
    }
    return block.text;
  }
}

function scorecardAnswer(lead: Lead, key: string): string {
  const a = lead.scorecardAnswers as Record<string, unknown> | undefined;
  if (!a) return 'Not provided';
  const v = a[key];
  return v != null && v !== '' ? String(v) : 'Not provided';
}
