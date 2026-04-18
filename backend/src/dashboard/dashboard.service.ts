import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import {
  Proposal,
  ProposalDocument,
} from '../proposals/schemas/proposal.schema';
import { DiscoveryCall, CallDocument } from '../calls/schemas/call.schema';
import {
  PipelineStage,
  PipelineStageDocument,
} from '../pipeline/schemas/pipeline-stage.schema';

type DashboardStats = {
  totalLeads: number;
  notReady: number;
  franchiseReady: number;
  recruitmentOnly: number;
  signedClients: number;
  weeklyDeltas: {
    totalLeads: number;
    notReady: number;
    franchiseReady: number;
    recruitmentOnly: number;
    signedClients: number;
  };
  funnel: { stage: string; count: number }[];
  todayAgenda: Array<{
    id: string;
    leadName: string;
    leadId: string;
    type: 'call' | 'proposal_followup' | 'wa_followup' | 'sequence_step';
    time: string;
    label: string;
  }>;
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Proposal.name)
    private readonly proposalModel: Model<ProposalDocument>,
    @InjectModel(DiscoveryCall.name)
    private readonly callModel: Model<CallDocument>,
    @InjectModel(PipelineStage.name)
    private readonly pipelineStageModel: Model<PipelineStageDocument>,
  ) {}

  async summary(): Promise<DashboardStats> {
    const [
      totalLeads,
      notReady,
      franchiseReady,
      recruitmentOnly,
      signedClients,
    ] = await Promise.all([
      this.leadModel.countDocuments().exec(),
      this.leadModel.countDocuments({ track: 'Not Ready' }).exec(),
      this.leadModel.countDocuments({ track: 'Franchise Ready' }).exec(),
      this.leadModel.countDocuments({ track: 'Recruitment Only' }).exec(),
      this.clientModel.countDocuments().exec(),
    ]);

    const funnelAgg = await this.leadModel
      .aggregate<{
        _id: string;
        count: number;
      }>([
        { $group: { _id: '$stage', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .exec();

    const funnel = funnelAgg.map((row) => ({
      stage: row._id,
      count: row.count,
    }));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const upcomingCalls = await this.callModel
      .find({
        status: 'upcoming',
        scheduledAt: {
          $gte: startOfToday.toISOString(),
          $lte: endOfToday.toISOString(),
        },
      })
      .sort({ scheduledAt: 1 })
      .limit(8)
      .lean<Array<DiscoveryCall & { _id: string }>>()
      .exec();

    const proposalFollowups = await this.proposalModel
      .find({
        status: 'Sent',
        openedAt: null,
      })
      .sort({ sentAt: -1 })
      .limit(5)
      .lean<Array<Proposal & { _id: string }>>()
      .exec();

    const agenda: DashboardStats['todayAgenda'] = [];

    for (const call of upcomingCalls) {
      const dt = new Date(call.scheduledAt);
      agenda.push({
        id: `call_${String(call._id)}`,
        leadName: call.leadName,
        leadId: call.leadId,
        type: 'call',
        time: dt.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        label: 'Discovery call',
      });
    }

    for (const p of proposalFollowups) {
      agenda.push({
        id: `proposal_${String(p._id)}`,
        leadName: p.leadName,
        leadId: p.leadId,
        type: 'proposal_followup',
        time: 'Anytime',
        label: `Follow up: ${p.program} proposal`,
      });
    }

    return {
      totalLeads,
      notReady,
      franchiseReady,
      recruitmentOnly,
      signedClients,
      weeklyDeltas: {
        totalLeads: 0,
        notReady: 0,
        franchiseReady: 0,
        recruitmentOnly: 0,
        signedClients: 0,
      },
      funnel: funnel.length > 0 ? funnel : [{ stage: 'No data yet', count: 0 }],
      todayAgenda: agenda.slice(0, 10),
    };
  }

  async lossReport() {
    const [stages, leads, clients] = await Promise.all([
      this.pipelineStageModel
        .find({ isActive: true })
        .sort({ track: 1, order: 1 })
        .lean<Array<PipelineStage & { _id: string }>>()
        .exec(),
      this.leadModel.find().lean<Array<Lead & { _id: string }>>().exec(),
      this.clientModel
        .find()
        .select('leadId')
        .lean<Array<{ leadId: string }>>()
        .exec(),
    ]);

    const signedLeadIds = new Set(clients.map((c) => String(c.leadId)));
    const activeLeads = leads.filter(
      (l) => String(l.status ?? '').toLowerCase() !== 'dead',
    );
    const lostLeadsRaw = leads
      .filter((l) => String(l.status ?? '').toLowerCase() === 'dead')
      .sort((a, b) => {
        const aTs = new Date((a as any).lostAt ?? (a as any).updatedAt ?? 0).getTime();
        const bTs = new Date((b as any).lostAt ?? (b as any).updatedAt ?? 0).getTime();
        return bTs - aTs;
      });

    const lossReasonLabels: Record<string, string> = {
      no_response: 'No Response / Ghosted',
      not_enough_capital: 'Not Enough Capital',
      bad_timing: 'Bad Timing',
      chose_competitor: 'Chose Competitor',
      price_too_high: 'Price Too High',
      not_serious: 'Not Serious Buyer',
      location_mismatch: 'Location Mismatch',
      changed_mind: 'Changed Mind',
      other: 'Other',
    };

    const normalizeReason = (reason?: string): string => {
      const r = String(reason ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
      if (!r) return 'other';
      return Object.prototype.hasOwnProperty.call(lossReasonLabels, r)
        ? r
        : 'other';
    };

    const stageDropoffs = stages.map((s, idx) => {
      const inStage = activeLeads.filter((l) => l.stage === s.name).length;
      const lostInStage = lostLeadsRaw.filter((l) => l.stage === s.name).length;
      const entered = inStage + lostInStage;
      const nextStage = stages[idx + 1];
      const exited =
        idx === stages.length - 1
          ? entered
          : activeLeads.filter((l) => l.stage === nextStage.name).length;
      const conversionRate = entered > 0 ? Math.round((exited / entered) * 100) : 0;

      return {
        stage: s.name,
        entered,
        exited,
        lost: lostInStage,
        avgDaysInStage: Math.max(1, Math.round((s.order + 1) * 2)),
        conversionRate,
      };
    });

    const reasonCounts = new Map<string, number>();
    for (const lead of lostLeadsRaw) {
      const reason = normalizeReason(lead.lostReason);
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    const totalLost = lostLeadsRaw.length || 1;
    const lossReasonStats = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({
        reason,
        label: lossReasonLabels[reason] ?? lossReasonLabels.other,
        count,
        percentage: Math.round((count / totalLost) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const bySource = new Map<
      string,
      { leads: number; signed: number; totalScore: number }
    >();
    for (const lead of leads) {
      const source = String(lead.source ?? 'Other');
      if (!bySource.has(source)) {
        bySource.set(source, { leads: 0, signed: 0, totalScore: 0 });
      }
      const row = bySource.get(source)!;
      row.leads += 1;
      row.totalScore += Number(lead.score ?? 0);
      const isSigned =
        signedLeadIds.has(String(lead._id)) ||
        String(lead.status ?? '').toLowerCase() === 'signed' ||
        String(lead.stage ?? '').toLowerCase() === 'signed';
      if (isSigned) row.signed += 1;
    }
    const sourceConversions = Array.from(bySource.entries())
      .map(([source, row]) => ({
        source,
        leads: row.leads,
        signed: row.signed,
        conversionRate:
          row.leads > 0
            ? Number(((row.signed / row.leads) * 100).toFixed(1))
            : 0,
        avgScore: row.leads > 0 ? Math.round(row.totalScore / row.leads) : 0,
        avgCPL: 0,
      }))
      .sort((a, b) => b.leads - a.leads);

    const buckets = [
      { key: '< 30 min', min: 0, max: 30, leads: 0, converted: 0 },
      { key: '30m - 1 hr', min: 30, max: 60, leads: 0, converted: 0 },
      { key: '1 - 2 hrs', min: 60, max: 120, leads: 0, converted: 0 },
      { key: '2 - 4 hrs', min: 120, max: 240, leads: 0, converted: 0 },
      { key: '4+ hrs', min: 240, max: Number.POSITIVE_INFINITY, leads: 0, converted: 0 },
    ];

    for (const lead of leads) {
      const createdTs = new Date((lead as any).createdAt ?? Date.now()).getTime();
      const updatedTs = new Date((lead as any).updatedAt ?? createdTs).getTime();
      const deltaMin = Math.max(0, Math.round((updatedTs - createdTs) / 60000));
      const bucket = buckets.find((b) => deltaMin >= b.min && deltaMin < b.max);
      if (!bucket) continue;
      bucket.leads += 1;
      const converted =
        signedLeadIds.has(String(lead._id)) ||
        String(lead.status ?? '').toLowerCase() === 'signed';
      if (converted) bucket.converted += 1;
    }
    const responseTimeConversions = buckets.map((b) => ({
      bucket: b.key,
      leads: b.leads,
      converted: b.converted,
      conversionRate:
        b.leads > 0 ? Number(((b.converted / b.leads) * 100).toFixed(1)) : 0,
    }));

    const now = Date.now();
    const lostLeads = lostLeadsRaw.slice(0, 50).map((lead) => {
      const reason = normalizeReason(lead.lostReason);
      const createdTs = new Date((lead as any).createdAt ?? now).getTime();
      const lostTs = new Date((lead as any).lostAt ?? (lead as any).updatedAt ?? now).getTime();
      const daysInPipeline = Math.max(
        1,
        Math.round((lostTs - createdTs) / (1000 * 60 * 60 * 24)),
      );
      return {
        leadId: String(lead._id),
        leadName: lead.name,
        reason,
        reasonLabel: lossReasonLabels[reason] ?? lossReasonLabels.other,
        lostAtStage: lead.stage ?? 'Unknown',
        lostAtTrack: lead.track ?? 'Unknown',
        notes: lead.notes ?? '',
        lostDate: new Date(lostTs).toISOString(),
        daysInPipeline,
        score: Number(lead.score ?? 0),
      };
    });

    return {
      stageDropoffs,
      lossReasonStats,
      sourceConversions,
      responseTimeConversions,
      lostLeads,
    };
  }
}
