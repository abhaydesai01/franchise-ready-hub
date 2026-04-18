import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Resend } from 'resend';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { DocumentStorageService } from '../documents/document-storage.service';
import { ProposalPdfSigningService } from '../documents/proposal-pdf-signing.service';
import { ProposalFollowupQueueService } from '../documents/proposal-followup-queue.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { ActivitiesService } from '../activities/activities.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { SettingsService } from '../settings/settings.service';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

function firstName(name: string): string {
  const n = name.trim().split(/\s+/)[0];
  return n || 'there';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class ProposalSendService {
  private readonly log = new Logger(ProposalSendService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly config: ConfigService,
    private readonly storage: DocumentStorageService,
    private readonly pdfSigning: ProposalPdfSigningService,
    private readonly followupQueue: ProposalFollowupQueueService,
    private readonly whatsapp: WhatsappCloudService,
    private readonly activities: ActivitiesService,
    private readonly pipeline: PipelineService,
    private readonly settings: SettingsService,
  ) {}

  async fetchPdfBuffer(url: string): Promise<Buffer> {
    if (url.startsWith('/uploads/')) {
      const rel = url.replace(/^\//, '');
      const diskPath = join(process.cwd(), rel);
      return readFile(diskPath);
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new BadRequestException(`Could not load PDF (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /** Full pipeline: pending_review → approved (with token) → sent + stage + jobs. */
  async approveAndSendProposal(
    leadId: string,
    docEntryId: string,
    user: CurrentUserPayload,
  ): Promise<void> {
    const lead = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) throw new NotFoundException('Lead not found');

    const doc = (lead.documents ?? []).find(
      (d) => String((d as { _id?: Types.ObjectId })._id) === docEntryId,
    );
    if (!doc || doc.documentType !== 'proposal') {
      throw new BadRequestException('Proposal document not found');
    }
    if (doc.status !== 'pending_review') {
      throw new BadRequestException('Document is not pending review');
    }

    const token = randomUUID();
    const rawPdf = await this.fetchPdfBuffer(doc.url);
    const withPlaceholder = await this.pdfSigning.addSigningPlaceholder(rawPdf);
    const fileName = `Proposal-${leadId}-${token.slice(0, 8)}-unsigned.pdf`;
    const { url: unsignedUrl } = await this.storage.savePdfFile(
      fileName,
      withPlaceholder,
    );

    const docOid = new Types.ObjectId(docEntryId);
    await this.leadModel
      .findOneAndUpdate(
        { _id: leadId, documents: { $elemMatch: { _id: docOid, status: 'pending_review' } } },
        {
          $set: {
            'documents.$.status': 'approved',
            'documents.$.proposalViewToken': token,
            'documents.$.unsignedPdfUrl': unsignedUrl,
            lastActivity: 'Just now',
            lastActivityType: 'proposal_approved',
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    const fromEmail =
      this.config.get<string>('resendFromEmail') ?? 'onboarding@resend.dev';
    const frontendBase = (
      this.config.get<string>('crmPublicUrl') ?? ''
    ).replace(/\/$/, '');
    const trackedUrl = `${frontendBase}/proposals/view/${token}`;
    const company =
      (await this.settings.getSettings())?.branding?.companyName?.trim() ||
      this.config.get<string>('companyName') ||
      'Franchise Ready';

    if (lead.email?.trim()) {
      await this.sendProposalEmail({
        to: lead.email.trim(),
        firstName: firstName(lead.name),
        companyName: company,
        pdfBuffer: withPlaceholder,
        fileName: `Proposal-${firstName(lead.name).replace(/\W+/g, '-')}.pdf`,
        trackedUrl,
        fromEmail,
      });
    } else {
      this.log.warn(`Lead ${leadId} has no email — skip proposal email`);
    }

    if (lead.phone) {
      const wa = `Hi ${firstName(lead.name)}, our consultant has prepared a personalised proposal for you based on your discovery call. Please find it in your email from ${fromEmail} — we'd love to hear your thoughts. Let us know if you have any questions!`;
      await this.whatsapp.sendText(lead.phone, wa);
    }

    const proposalSentAt = new Date();
    const proposalStage = await this.pipeline.findStageByTrackAndName(
      'Franchise Ready',
      'Proposal Sent',
    );

    await this.leadModel
      .findOneAndUpdate(
        { _id: leadId, 'documents._id': docOid },
        {
          $set: {
            'documents.$.status': 'sent',
            'documents.$.proposalSentAt': proposalSentAt,
            'documents.$.proposalViewCount': 0,
            stage: 'Proposal Sent',
            ...(proposalStage
              ? { pipelineStageId: new Types.ObjectId(String(proposalStage._id)) }
              : {}),
            lastActivity: 'Just now',
            lastActivityType: 'proposal_sent',
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    await this.activities.createForLead(leadId, {
      type: 'proposal_sent',
      description: `Proposal sent — tracked link. ${proposalSentAt.toISOString()}`,
      addedBy: user.name,
    });

    await this.followupQueue.scheduleForProposalSent(
      leadId,
      docEntryId,
      proposalSentAt,
    );
  }

  private async sendProposalEmail(input: {
    to: string;
    firstName: string;
    companyName: string;
    pdfBuffer: Buffer;
    fileName: string;
    trackedUrl: string;
    fromEmail: string;
  }): Promise<void> {
    const apiKey = this.config.get<string>('resendApiKey') ?? '';
    if (!apiKey) {
      this.log.warn('RESEND_API_KEY not set — skip proposal email');
      return;
    }
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: input.fromEmail,
      to: input.to,
      subject: `Your personalised proposal — ${escapeHtml(input.companyName)}`,
      html: `
<p>Hi ${escapeHtml(input.firstName)},</p>
<p>Please find your proposal attached. You can also view it online anytime:</p>
<p><a href="${escapeHtml(input.trackedUrl)}">${escapeHtml(input.trackedUrl)}</a></p>
<p>We would love to hear your thoughts.</p>
<p>— ${escapeHtml(input.companyName)}</p>
`,
      attachments: [{ filename: input.fileName, content: input.pdfBuffer }],
    });
    if (error) {
      this.log.error(`Proposal email failed: ${error.message}`);
    }
  }

  async approveAndSendMom(
    leadId: string,
    docEntryId: string,
    user: CurrentUserPayload,
  ): Promise<void> {
    const lead = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) throw new NotFoundException('Lead not found');
    const doc = (lead.documents ?? []).find(
      (d) => String((d as { _id?: Types.ObjectId })._id) === docEntryId,
    );
    if (!doc || doc.documentType !== 'mom') {
      throw new BadRequestException('MOM document not found');
    }
    if (doc.status !== 'pending_review') {
      throw new BadRequestException('Document is not pending review');
    }

    const fromEmail =
      this.config.get<string>('resendFromEmail') ?? 'onboarding@resend.dev';

    await this.leadModel
      .findOneAndUpdate(
        {
          _id: leadId,
          documents: { $elemMatch: { _id: new Types.ObjectId(docEntryId), status: 'pending_review' } },
        },
        {
          $set: {
            'documents.$.status': 'approved',
            updatedAt: new Date(),
          },
        },
      )
      .exec();

    if (lead.email?.trim()) {
      const pdfBuffer = await this.fetchPdfBuffer(doc.url);
      const apiKey = this.config.get<string>('resendApiKey') ?? '';
      if (apiKey) {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: fromEmail,
          to: lead.email.trim(),
          subject: `Minutes of Meeting — ${escapeHtml(lead.name)}`,
          html: `<p>Hi ${escapeHtml(firstName(lead.name))},</p><p>Please find your meeting notes attached.</p>`,
          attachments: [
            {
              filename: `MOM-${firstName(lead.name).replace(/\W+/g, '-')}.pdf`,
              content: pdfBuffer,
            },
          ],
        });
      }
    }
    if (lead.phone) {
      await this.whatsapp.sendText(
        lead.phone,
        `Hi ${firstName(lead.name)}, we've emailed your minutes of meeting from ${fromEmail}. Let us know if you have any questions.`,
      );
    }

    await this.leadModel
      .findOneAndUpdate(
        { _id: leadId, 'documents._id': new Types.ObjectId(docEntryId) },
        {
          $set: {
            'documents.$.status': 'sent',
            lastActivity: 'Just now',
            lastActivityType: 'document_approved_sent',
            updatedAt: new Date(),
          },
        },
      )
      .exec();

    await this.activities.createForLead(leadId, {
      type: 'document_approved_sent',
      description: 'MOM approved and sent by email/WhatsApp.',
      addedBy: user.name,
    });
  }
}
