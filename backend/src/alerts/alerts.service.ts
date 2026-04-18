import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SalesAlert, SalesAlertDocument } from './schemas/sales-alert.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';
import { DiscoveryCall, CallDocument } from '../calls/schemas/call.schema';
import { Proposal, ProposalDocument } from '../proposals/schemas/proposal.schema';
import {
  AppSettings,
  SettingsDocument,
} from '../settings/schemas/settings.schema';

@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(SalesAlert.name)
    private readonly alertModel: Model<SalesAlertDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(DiscoveryCall.name)
    private readonly callModel: Model<CallDocument>,
    @InjectModel(Proposal.name)
    private readonly proposalModel: Model<ProposalDocument>,
    @InjectModel(AppSettings.name)
    private readonly settingsModel: Model<SettingsDocument>,
  ) {}

  private async syncGeneratedAlerts() {
    await this.alertModel.deleteMany({ alertKey: { $exists: false } }).exec();

    const [leads, proposals, calls, settings] = await Promise.all([
      this.leadModel
        .find()
        .lean<Array<Lead & { _id: string }>>()
        .exec(),
      this.proposalModel
        .find()
        .lean<Array<Proposal & { _id: string }>>()
        .exec(),
      this.callModel
        .find()
        .lean<Array<DiscoveryCall & { _id: string }>>()
        .exec(),
      this.settingsModel.findOne().lean<(AppSettings & { _id: string }) | null>().exec(),
    ]);

    const rules = settings?.alertRules ?? {
      coldLeadDaysWarning: 5,
      coldLeadDaysCritical: 8,
      stuckStageDaysWarning: 7,
      stuckStageDaysCritical: 12,
      proposalNotOpenedDaysInfo: 2,
      proposalNotOpenedDaysWarning: 5,
    };

    const now = Date.now();
    const candidateAlerts: Array<{
      alertKey: string;
      leadId: string;
      leadName: string;
      category: string;
      priority: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      createdAt: string;
      actionLabel?: string;
      actionType?: string;
    }> = [];

    for (const lead of leads) {
      const leadId = String(lead._id);
      const leadName = lead.name;
      const updatedTs = new Date((lead as any).updatedAt ?? (lead as any).createdAt ?? now).getTime();
      const ageDays = Math.floor((now - updatedTs) / (1000 * 60 * 60 * 24));

      if (
        String(lead.status ?? '').toLowerCase() !== 'dead' &&
        ageDays >= rules.coldLeadDaysWarning
      ) {
        candidateAlerts.push({
          alertKey: `cold:${leadId}`,
          leadId,
          leadName,
          category: 'lead_cold',
          priority:
            ageDays >= rules.coldLeadDaysCritical ? 'critical' : 'warning',
          title: 'Lead Going Cold',
          description: `${leadName} has no activity for ${ageDays} days.`,
          createdAt: new Date(updatedTs).toISOString(),
          actionLabel: 'Send WhatsApp',
          actionType: 'send_wa',
        });
      }

      const stageDays = Number(lead.stageDuration ?? 0);
      if (
        String(lead.status ?? '').toLowerCase() !== 'dead' &&
        stageDays >= rules.stuckStageDaysWarning
      ) {
        candidateAlerts.push({
          alertKey: `stuck:${leadId}`,
          leadId,
          leadName,
          category: 'stage_stuck',
          priority:
            stageDays >= rules.stuckStageDaysCritical ? 'critical' : 'warning',
          title: 'Stuck in Stage',
          description: `${leadName} has been in "${lead.stage}" for ${stageDays} days.`,
          createdAt: new Date(updatedTs).toISOString(),
          actionLabel: 'Book Call',
          actionType: 'book_call',
        });
      }
    }

    for (const proposal of proposals) {
      if (!proposal.sentAt || proposal.openedAt) continue;
      const sentTs = new Date(proposal.sentAt).getTime();
      if (Number.isNaN(sentTs)) continue;
      const days = Math.floor((now - sentTs) / (1000 * 60 * 60 * 24));
      if (days < rules.proposalNotOpenedDaysInfo) continue;
      candidateAlerts.push({
        alertKey: `proposal-not-opened:${proposal.leadId}`,
        leadId: proposal.leadId,
        leadName: proposal.leadName,
        category: 'proposal_not_opened',
        priority:
          days >= rules.proposalNotOpenedDaysWarning ? 'warning' : 'info',
        title: 'Proposal Not Opened',
        description: `${proposal.leadName} has not opened the proposal for ${days} days.`,
        createdAt: new Date(sentTs).toISOString(),
        actionLabel: 'Send WhatsApp',
        actionType: 'send_wa',
      });
    }

    for (const call of calls) {
      if (call.status !== 'noshow' || call.followUpSent) continue;
      const when = new Date(call.scheduledAt).toISOString();
      candidateAlerts.push({
        alertKey: `noshow:${call.leadId}`,
        leadId: call.leadId,
        leadName: call.leadName,
        category: 'noshow_no_reengagement',
        priority: 'warning',
        title: 'No-show Without Follow-up',
        description: `${call.leadName} missed a call and follow-up is pending.`,
        createdAt: when,
        actionLabel: 'Book Call',
        actionType: 'book_call',
      });
    }

    for (const alert of candidateAlerts) {
      const existing = await this.alertModel
        .findOne({ alertKey: alert.alertKey })
        .lean<(SalesAlert & { _id: string }) | null>()
        .exec();

      await this.alertModel
        .updateOne(
          { alertKey: alert.alertKey },
          {
            $set: {
              ...alert,
              // preserve manual dismiss state unless alert is brand new
              dismissed: existing?.dismissed ?? false,
            },
          },
          { upsert: true },
        )
        .exec();
    }
  }

  async list(params?: { priority?: 'all' | 'critical' | 'warning' | 'info' }) {
    await this.syncGeneratedAlerts();

    const query = this.alertModel.find({ dismissed: false });

    if (params?.priority && params.priority !== 'all') {
      query.where('priority').equals(params.priority);
    }

    return query
      .sort({ createdAt: -1 })
      .lean<Array<SalesAlert & { _id: string }>>()
      .exec();
  }

  async counts() {
    await this.syncGeneratedAlerts();

    const base = { dismissed: false };

    const [all, critical, warning, info] = await Promise.all([
      this.alertModel.countDocuments(base).exec(),
      this.alertModel.countDocuments({ ...base, priority: 'critical' }).exec(),
      this.alertModel.countDocuments({ ...base, priority: 'warning' }).exec(),
      this.alertModel.countDocuments({ ...base, priority: 'info' }).exec(),
    ]);

    return { all, critical, warning, info };
  }

  async dismiss(id: string) {
    await this.alertModel
      .findByIdAndUpdate(id, { $set: { dismissed: true } })
      .exec();
    return { ok: true };
  }

  async upsertOne(input: {
    alertKey: string;
    leadId: string;
    leadName: string;
    category: string;
    priority: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    actionLabel?: string;
    actionType?: string;
  }) {
    const createdAt = new Date().toISOString();
    await this.alertModel
      .findOneAndUpdate(
        { alertKey: input.alertKey },
        {
          $set: {
            ...input,
            createdAt,
            dismissed: false,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  async dismissByKey(alertKey: string) {
    await this.alertModel
      .updateMany({ alertKey }, { $set: { dismissed: true } })
      .exec();
  }

  async executeAction(id: string, note?: string) {
    await this.syncGeneratedAlerts();
    const alert = await this.alertModel
      .findById(id)
      .lean<(SalesAlert & { _id: string }) | null>()
      .exec();
    if (!alert) throw new NotFoundException('Alert not found');

    if (!alert.actionType || alert.actionType === 'view_lead') {
      return { ok: true, message: 'Open lead profile', leadId: alert.leadId };
    }

    const lead = await this.leadModel
      .findById(alert.leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) {
      throw new NotFoundException('Lead for this alert was not found');
    }

    const nowIso = new Date().toISOString();
    const touchLead = async (lastActivityType: string) => {
      await this.leadModel
        .findByIdAndUpdate(String(lead._id), {
          $set: {
            lastActivity: 'Just now',
            lastActivityType,
            updatedAt: new Date(),
          },
        })
        .exec();
    };

    if (alert.actionType === 'send_wa') {
      const text =
        note?.trim() ||
        `Hi ${lead.name}, quick follow-up from Franchise Ready regarding your inquiry.`;
      await this.activityModel.create({
        leadId: String(lead._id),
        leadName: lead.name,
        type: 'wa_sent',
        description: text,
        timestamp: nowIso,
        addedBy: 'alerts-action',
      });
      await touchLead('WhatsApp follow-up sent');
      return { ok: true, message: 'WhatsApp follow-up logged', leadId: String(lead._id) };
    }

    if (alert.actionType === 'book_call') {
      const dt = new Date();
      dt.setDate(dt.getDate() + 1);
      dt.setHours(11, 0, 0, 0);
      const scheduledAt = dt.toISOString();

      const created = await this.callModel.create({
        leadId: String(lead._id),
        leadName: lead.name,
        track: lead.track ?? 'Not Ready',
        score: Number(lead.score ?? 0),
        scheduledAt,
        status: 'upcoming',
        notes: note?.trim() || `Auto-booked from alert: ${alert.title}`,
        proposalGenerated: false,
        consultantName: lead.assignedTo || 'Unassigned',
        calcomLink: '',
      });

      await this.activityModel.create({
        leadId: String(lead._id),
        leadName: lead.name,
        type: 'call_booked',
        description: `Call booked for ${new Date(scheduledAt).toLocaleString('en-IN')}`,
        timestamp: nowIso,
        addedBy: 'alerts-action',
      });
      await touchLead('Call booked');

      return {
        ok: true,
        message: 'Call booked from alert',
        leadId: String(lead._id),
        callId: String((created as any)._id),
      };
    }

    if (alert.actionType === 'add_note') {
      const text = note?.trim() || `Alert note: ${alert.description}`;
      await this.activityModel.create({
        leadId: String(lead._id),
        leadName: lead.name,
        type: 'note_added',
        description: text,
        timestamp: nowIso,
        addedBy: 'alerts-action',
      });
      await touchLead('Note added');
      return { ok: true, message: 'Note added from alert', leadId: String(lead._id) };
    }

    if (alert.actionType === 'send_proposal') {
      const existing = await this.proposalModel
        .findOne({ leadId: String(lead._id), status: { $in: ['Draft', 'Sent', 'Opened'] } })
        .lean<(Proposal & { _id: string }) | null>()
        .exec();

      if (existing) {
        return {
          ok: true,
          message: 'Existing open proposal already present',
          leadId: String(lead._id),
          proposalId: String(existing._id),
        };
      }

      const program =
        lead.track === 'Franchise Ready'
          ? 'Franchise Ready'
          : lead.track === 'Recruitment Only'
            ? 'Franchise Launch'
            : 'Franchise Ready';
      const created = await this.proposalModel.create({
        leadId: String(lead._id),
        leadName: lead.name,
        track: lead.track ?? 'Not Ready',
        program,
        status: 'Draft',
        content:
          note?.trim() ||
          `Auto-generated proposal from alert "${alert.title}" for ${lead.name}.`,
        createdAt: new Date().toISOString().split('T')[0],
        sentAt: null,
        openedAt: null,
        signedAt: null,
      });

      await this.activityModel.create({
        leadId: String(lead._id),
        leadName: lead.name,
        type: 'proposal_sent',
        description: `Draft proposal created (${program})`,
        timestamp: nowIso,
        addedBy: 'alerts-action',
      });
      await touchLead('Proposal prepared');

      return {
        ok: true,
        message: 'Proposal draft created',
        leadId: String(lead._id),
        proposalId: String((created as any)._id),
      };
    }

    return { ok: true, message: 'No action executed', leadId: String(lead._id) };
  }
}
