import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { SettingsService } from '../settings/settings.service';
import { ActivitiesService } from '../activities/activities.service';
import { CrmSettings } from './schemas/crm-settings.schema';
import { ScorecardPdfService, type PdfBranding } from './scorecard-pdf.service';
import { ScorecardStorageService } from './scorecard-storage.service';
import { ScorecardEmailService } from './scorecard-email.service';
import { ScorecardWhatsappService } from './scorecard-whatsapp.service';
import {
  computeGapAreas,
  readinessSummaryTemplate,
} from './scorecard-gaps';
import type {
  ReadinessBand,
  ScorecardDataPayload,
  ScoreDimensionRow,
} from './scorecard.types';

const WA_CAPTION =
  'Here is your personalised Franchise Readiness Report! Our consultant will walk you through this on your discovery call.';

@Injectable()
export class ScorecardService {
  private readonly log = new Logger(ScorecardService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(CrmSettings.name)
    private readonly crmSettingsModel: Model<CrmSettings>,
    private readonly settingsService: SettingsService,
    private readonly activitiesService: ActivitiesService,
    private readonly pdfService: ScorecardPdfService,
    private readonly storageService: ScorecardStorageService,
    private readonly emailService: ScorecardEmailService,
    private readonly whatsappService: ScorecardWhatsappService,
    private readonly config: ConfigService,
  ) {}

  async generateAndDeliver(leadId: string): Promise<{
    ok: boolean;
    skipped?: boolean;
    reason?: string;
  }> {
    const lead = await this.leadModel.findById(leadId).exec();
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (lead.scorecardSentAt) {
      return { ok: true, skipped: true, reason: 'already_sent' };
    }

    if (lead.totalScore === undefined || lead.totalScore === null) {
      throw new BadRequestException('Lead has no totalScore — run SCORING first');
    }
    if (!lead.readinessBand) {
      throw new BadRequestException('Lead has no readinessBand');
    }

    const readinessBand = lead.readinessBand as ReadinessBand;
    const dimensions = this.normalizeDimensions(lead.scoreDimensions ?? []);
    const gapAreas = computeGapAreas(lead.scoreDimensions ?? []);
    const readinessSummary = readinessSummaryTemplate(readinessBand);

    const app = await this.settingsService.getSettings();
    const branding = this.resolveBranding(app);

    const generatedAt = new Date().toISOString();
    const generatedLabel = new Date().toLocaleDateString('en-IN', {
      dateStyle: 'long',
    });
    const pdfFileName = `Franchise-Readiness-Report-${leadId}.pdf`;

    const pdfBuffer = await this.pdfService.buildPdf({
      leadName: lead.name,
      generatedLabel,
      readinessBand,
      totalScore: lead.totalScore,
      dimensions,
      readinessSummary,
      gapAreas,
      branding,
    });

    const { url: scorecardPdfUrl } = await this.storageService.savePdf(
      leadId,
      pdfBuffer,
    );

    const scorecardData: ScorecardDataPayload = {
      version: 1,
      generatedAt,
      totalScore: lead.totalScore,
      readinessBand,
      readinessSummary,
      dimensions,
      gapAreas,
      pdfFileName,
      scorecardPdfUrl,
      brandingCompanyName: branding.companyName,
    };

    const crm = await this.crmSettingsModel.findOne().lean().exec();
    const calendlyHint =
      crm?.calendlyLink?.trim() ||
      this.config.get<string>('calendlyLink')?.trim() ||
      '';

    const firstName = (lead.name ?? 'there').trim().split(/\s+/)[0] || 'there';

    const waPromise =
      lead.phone?.trim().length ?? 0
        ? this.whatsappService.sendPdfDocument({
            toPhone: lead.phone as string,
            pdfBuffer,
            fileName: pdfFileName,
            caption: WA_CAPTION,
          })
        : Promise.resolve({ ok: false, error: 'no_phone' as const });

    const emailPromise =
      lead.email?.trim().length ?? 0
        ? this.emailService.sendScorecardAttachment({
            to: lead.email as string,
            firstName,
            companyName: branding.companyName,
            calendlyHint: calendlyHint || undefined,
            pdfBuffer,
            fileName: pdfFileName,
          })
        : Promise.resolve({ ok: false, error: 'no_email' as const });

    const [, waResult, emailResult] = await Promise.all([
      this.leadModel
        .findByIdAndUpdate(leadId, {
          $set: {
            scorecardPdfUrl,
            scorecardData: scorecardData as unknown as Record<string, unknown>,
            scorecardSentAt: new Date(),
          },
        })
        .exec(),
      waPromise,
      emailPromise,
    ]);

    if (!lead.phone?.trim()) {
      this.log.warn(`Lead ${leadId} has no phone — WhatsApp scorecard skipped`);
    } else if (!waResult.ok) {
      this.log.warn(`WhatsApp scorecard delivery failed: ${waResult.error}`);
    }

    if (!lead.email?.trim()) {
      this.log.warn(`Lead ${leadId} has no email — email scorecard skipped`);
    } else if (!emailResult.ok) {
      this.log.warn(`Email scorecard delivery failed: ${emailResult.error}`);
    }

    await this.activitiesService.recordScorecardSent(String(lead._id));

    return { ok: true };
  }

  private normalizeDimensions(
    raw: Array<{ name: string; score: number; max: number }>,
  ): ScoreDimensionRow[] {
    const order = [
      { key: 'capital', re: /capital/i, label: 'Capital' },
      { key: 'experience', re: /experience/i, label: 'Business experience' },
      { key: 'location', re: /location/i, label: 'Location / market' },
      { key: 'property', re: /property/i, label: 'Property' },
      { key: 'motivation', re: /motivation/i, label: 'Motivation' },
      { key: 'intent', re: /intent/i, label: 'Intent / timeline' },
    ];

    const rows: ScoreDimensionRow[] = [];
    for (const o of order) {
      const hit = raw.find((d) => o.re.test(d.name ?? ''));
      if (hit) {
        rows.push({
          key: o.key,
          label: o.label,
          score: hit.score,
          max: hit.max,
        });
      }
    }
    if (rows.length) return rows;

    return raw.map((d, i) => ({
      key: `d${i}`,
      label: d.name,
      score: d.score,
      max: d.max,
    }));
  }

  private resolveBranding(app: {
    branding?: {
      companyName?: string;
      logoUrl?: string;
      supportEmail?: string;
      supportPhone?: string;
      website?: string;
      addressLine?: string;
    };
  } | null): PdfBranding {
    const b = app?.branding;
    return {
      companyName:
        b?.companyName?.trim() ||
        this.config.get<string>('COMPANY_NAME') ||
        'Franchise Ready',
      logoUrl: b?.logoUrl?.trim() ?? '',
      supportEmail: b?.supportEmail?.trim() ?? '',
      supportPhone: b?.supportPhone?.trim() ?? '',
      website: b?.website?.trim() ?? '',
      addressLine: b?.addressLine?.trim() ?? '',
    };
  }
}
