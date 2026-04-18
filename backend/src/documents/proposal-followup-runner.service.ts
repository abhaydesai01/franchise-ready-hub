import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { SettingsService } from '../settings/settings.service';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from '../alerts/alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ProposalFollowupJobData } from './proposal-followup-queue.service';

function firstName(name: string): string {
  const n = name.trim().split(/\s+/)[0];
  return n || 'there';
}

@Injectable()
export class ProposalFollowupRunnerService {
  private readonly log = new Logger(ProposalFollowupRunnerService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly whatsapp: WhatsappCloudService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
    private readonly alerts: AlertsService,
    private readonly notifications: NotificationsService,
  ) {}

  async runCheckin48h(data: ProposalFollowupJobData): Promise<void> {
    const lead = await this.leadModel
      .findById(data.leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) {
      this.log.warn(`check-in: lead ${data.leadId} missing`);
      return;
    }
    const doc = (lead.documents ?? []).find(
      (d) => String((d as { _id?: Types.ObjectId })._id) === data.documentEntryId,
    );
    if (!doc || doc.documentType !== 'proposal') return;
    if (doc.status === 'signed') return;

    if (!lead.phone) return;

    const msg = `Hi ${firstName(lead.name)}, just checking in on the proposal we shared. Do you have any questions I can help clarify? Our consultant is happy to jump on a quick call if that would help. 😊`;
    await this.whatsapp.sendText(lead.phone, msg);

    await this.leadModel
      .findByIdAndUpdate(data.leadId, {
        $set: { proposalCheckinSentAt: new Date(), updatedAt: new Date() },
      })
      .exec();
  }

  async runEscalate7d(data: ProposalFollowupJobData): Promise<void> {
    const lead = await this.leadModel
      .findById(data.leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) {
      this.log.warn(`escalate: lead ${data.leadId} missing`);
      return;
    }
    const docs = lead.documents ?? [];
    const doc = docs.find(
      (d) => String((d as { _id?: Types.ObjectId })._id) === data.documentEntryId,
    );
    if (!doc || doc.documentType !== 'proposal') return;
    if (doc.status === 'signed') return;

    const app = await this.settings.getSettings();
    const calendly =
      app?.calendlyLink?.trim() ||
      this.config.get<string>('calendlyLink') ||
      '';

    await this.alerts.upsertOne({
      alertKey: `proposal_unsigned_7d:${data.leadId}:${data.documentEntryId}`,
      leadId: String(lead._id),
      leadName: lead.name,
      category: 'proposal_unsigned',
      priority: 'critical',
      title: 'Proposal unsigned after 7 days',
      description: `Proposal unsigned after 7 days — ${lead.name} requires personal follow-up.`,
      actionLabel: 'Open lead',
      actionType: 'view_lead',
    });

    if (lead.ownerId) {
      await this.notifications.notifyUser({
        userId: String(lead.ownerId),
        type: 'proposal_unsigned_escalation',
        description: `Proposal unsigned after 7 days — ${lead.name} requires personal follow-up.`,
        leadId: String(lead._id),
      });
    }

    if (lead.phone && calendly) {
      const msg = `Hi ${firstName(lead.name)}, I wanted to follow up one last time on the proposal — we genuinely believe this is the right move for you and we don't want you to miss the opportunity. Would it help to get on a quick call to talk through any concerns? Here's our booking link: ${calendly}`;
      await this.whatsapp.sendText(lead.phone, msg);
    }
  }
}
