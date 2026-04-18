import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import {
  ProposalViewEvent,
  ProposalViewEventDocument,
} from './schemas/proposal-view.schema';
import { ProposalPdfSigningService } from '../documents/proposal-pdf-signing.service';
import { DocumentStorageService } from '../documents/document-storage.service';
import { ProposalSendService } from './proposal-send.service';
import { QueueCancellationService } from '../calendly/queue-cancellation.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { ActivitiesService } from '../activities/activities.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClientsService } from '../clients/clients.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { SettingsService } from '../settings/settings.service';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from '../alerts/alerts.service';

function firstName(name: string): string {
  const n = name.trim().split(/\s+/)[0];
  return n || 'there';
}

@Injectable()
export class ProposalPublicService {
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(ProposalViewEvent.name)
    private readonly viewModel: Model<ProposalViewEventDocument>,
    private readonly pdfSigning: ProposalPdfSigningService,
    private readonly storage: DocumentStorageService,
    private readonly proposalSend: ProposalSendService,
    private readonly queueCancel: QueueCancellationService,
    private readonly whatsapp: WhatsappCloudService,
    private readonly activities: ActivitiesService,
    private readonly notifications: NotificationsService,
    private readonly clients: ClientsService,
    private readonly pipeline: PipelineService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
    private readonly alerts: AlertsService,
  ) {}

  private findDocByToken(token: string) {
    return this.leadModel
      .findOne({ 'documents.proposalViewToken': token })
      .lean<(Lead & { _id: string }) | null>()
      .exec();
  }

  async getViewMeta(token: string) {
    const lead = await this.findDocByToken(token);
    if (!lead) throw new NotFoundException('Proposal not found');
    const doc = (lead.documents ?? []).find((d) => d.proposalViewToken === token);
    if (!doc || doc.documentType !== 'proposal') {
      throw new NotFoundException('Proposal not found');
    }
    const pdfUrl =
      doc.unsignedPdfUrl?.trim() || doc.url;
    const company =
      (await this.settings.getSettings())?.branding?.companyName?.trim() ||
      this.config.get<string>('companyName') ||
      'Franchise Ready';
    return {
      pdfUrl,
      leadFirstName: firstName(lead.name),
      companyName: company,
      alreadySigned: doc.status === 'signed',
    };
  }

  async trackView(
    token: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<void> {
    const lead = await this.findDocByToken(token);
    if (!lead) throw new NotFoundException('Proposal not found');
    const doc = (lead.documents ?? []).find((d) => d.proposalViewToken === token);
    if (!doc) throw new NotFoundException('Proposal not found');
    const docId = doc._id;
    if (!docId) throw new NotFoundException('Proposal not found');

    const viewedAt = new Date();
    await this.viewModel.create({
      leadId: String(lead._id),
      documentEntryId: String(docId),
      proposalViewToken: token,
      viewedAt,
      userAgent,
      ipAddress,
    });

    await this.leadModel
      .findOneAndUpdate(
        { _id: lead._id, 'documents._id': docId },
        {
          $inc: { 'documents.$.proposalViewCount': 1 },
          $set: {
            'documents.$.proposalLastViewedAt': viewedAt,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async signProposal(token: string, signaturePngBase64: string): Promise<void> {
    const lead = await this.leadModel
      .findOne({ 'documents.proposalViewToken': token })
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) throw new NotFoundException('Proposal not found');

    const doc = (lead.documents ?? []).find((d) => d.proposalViewToken === token);
    if (!doc) throw new NotFoundException('Proposal not found');
    if (doc.status === 'signed') {
      throw new BadRequestException('Already signed');
    }

    const raw = signaturePngBase64.includes(',')
      ? signaturePngBase64.split(',')[1]!
      : signaturePngBase64;
    const pngBytes = Buffer.from(raw, 'base64');

    const pdfUrl = doc.unsignedPdfUrl?.trim() || doc.url;
    const pdfBytes = await this.proposalSend.fetchPdfBuffer(pdfUrl);
    const signedBuffer = await this.pdfSigning.embedSignatureAndTimestamp(
      pdfBytes,
      pngBytes,
    );

    const fileName = `Proposal-signed-${lead._id}-${Date.now()}.pdf`;
    const { url: signedUrl } = await this.storage.savePdfFile(fileName, signedBuffer);

    const signedAt = new Date();
    const entryId = doc._id;
    if (!entryId) throw new NotFoundException('Proposal not found');

    const track = lead.track?.trim() || 'Franchise Ready';
    const signedStage = await this.pipeline.findStageByTrackAndName(track, 'Signed');

    await this.leadModel
      .findOneAndUpdate(
        { _id: lead._id, 'documents.proposalViewToken': token },
        {
          $set: {
            'documents.$.status': 'signed',
            'documents.$.signedPdfUrl': signedUrl,
            'documents.$.signedAt': signedAt,
            stage: 'Signed',
            ...(signedStage
              ? { pipelineStageId: new Types.ObjectId(String(signedStage._id)) }
              : {}),
            lastActivity: 'Just now',
            lastActivityType: 'proposal_signed',
            updatedAt: new Date(),
          },
        },
      )
      .exec();

    const leadIdStr = String(lead._id);
    await this.queueCancel.cancelAllJobsForLead(leadIdStr);

    await this.alerts.dismissByKey(
      `proposal_unsigned_7d:${leadIdStr}:${String(entryId)}`,
    );

    if (lead.phone) {
      await this.whatsapp.sendText(
        lead.phone,
        `Hi ${firstName(lead.name)}, welcome aboard! We're thrilled to have you on board and can't wait to get started.`,
      );
    }

    if (lead.ownerId) {
      await this.notifications.notifyUser({
        userId: String(lead.ownerId),
        type: 'proposal_signed',
        description: `Proposal signed by ${lead.name} — time to onboard!`,
        leadId: leadIdStr,
      });
    }

    const program =
      lead.track === 'Franchise Ready'
        ? 'Franchise Ready'
        : lead.track === 'Recruitment Only'
          ? 'Franchise Launch'
          : 'Franchise Ready';

    await this.clients.createFromSignedLead({
      leadId: leadIdStr,
      name: lead.name,
      program,
    });

    await this.activities.createForLead(leadIdStr, {
      type: 'proposal_signed',
      description: `Proposal signed electronically at ${signedAt.toISOString()}`,
      addedBy: 'Lead (public)',
    });
  }

  async recordCheckinWhatsAppReply(
    leadId: string,
    replySnippet: string,
  ): Promise<{ ok: boolean; skipped?: string }> {
    const lead = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) {
      return { ok: false, skipped: 'lead_not_found' };
    }
    if (!lead.proposalCheckinSentAt) {
      return { ok: false, skipped: 'no_checkin' };
    }
    if (lead.proposalCheckinReplyAlertAt) {
      return { ok: true, skipped: 'already_handled' };
    }
    const proposals = (lead.documents ?? []).filter(
      (d) => d.documentType === 'proposal',
    );
    const latest = proposals.length ? proposals[proposals.length - 1] : null;
    if (!latest || latest.status === 'signed') {
      return { ok: false, skipped: 'no_open_proposal' };
    }

    const clip = replySnippet.slice(0, 500);
    await this.activities.createForLead(leadId, {
      type: 'note_added',
      description: `WhatsApp reply after proposal check-in: ${clip}`,
      addedBy: 'WhatsApp',
    });

    await this.alerts.upsertOne({
      alertKey: `proposal_checkin_reply:${leadId}`,
      leadId,
      leadName: lead.name,
      category: 'proposal_checkin',
      priority: 'critical',
      title: 'Proposal check-in reply',
      description: `${lead.name} replied after the 48h proposal check-in — respond manually within 4 hours.`,
      actionLabel: 'Open lead',
      actionType: 'view_lead',
    });

    if (lead.ownerId) {
      await this.notifications.notifyUser({
        userId: String(lead.ownerId),
        type: 'proposal_checkin_reply',
        description: `Proposal check-in reply from ${lead.name} — please respond within 4 hours.`,
        leadId,
      });
    }

    await this.leadModel
      .findByIdAndUpdate(leadId, {
        $set: { proposalCheckinReplyAlertAt: new Date(), updatedAt: new Date() },
      })
      .exec();

    return { ok: true };
  }
}
