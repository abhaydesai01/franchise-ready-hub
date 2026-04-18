import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AutomationSequence,
  AutomationSequenceDocument,
} from './schemas/automation-sequence.schema';
import {
  AutomationLog,
  AutomationLogDocument,
} from './schemas/automation-log.schema';
import {
  ReEngagementRule,
  ReEngagementRuleDocument,
} from './schemas/re-engagement-rule.schema';
import {
  ReEngagementLog,
  ReEngagementLogDocument,
} from './schemas/re-engagement-log.schema';
import { automationSequencesSeed } from './seed/automation-sequences.seed';
import { automationLogsSeed } from './seed/automation-logs.seed';
import { reEngagementRulesSeed } from './seed/re-engagement-rules.seed';
import { reEngagementLogsSeed } from './seed/re-engagement-logs.seed';
import { UpdateAutomationSequenceDto } from './dto/update-automation-sequence.dto';

@Injectable()
export class AutomationService {
  constructor(
    @InjectModel(AutomationSequence.name)
    private readonly sequenceModel: Model<AutomationSequenceDocument>,
    @InjectModel(AutomationLog.name)
    private readonly logModel: Model<AutomationLogDocument>,
    @InjectModel(ReEngagementRule.name)
    private readonly ruleModel: Model<ReEngagementRuleDocument>,
    @InjectModel(ReEngagementLog.name)
    private readonly reLogModel: Model<ReEngagementLogDocument>,
  ) {}

  private async ensureSequences() {
    const count = await this.sequenceModel.estimatedDocumentCount().exec();
    if (count > 0) return;
    await this.sequenceModel.insertMany(automationSequencesSeed);
  }

  private async ensureLogs() {
    const count = await this.logModel.estimatedDocumentCount().exec();
    if (count > 0) return;
    await this.logModel.insertMany(automationLogsSeed);
  }

  private async ensureRules() {
    const count = await this.ruleModel.estimatedDocumentCount().exec();
    if (count > 0) return;
    await this.ruleModel.insertMany(reEngagementRulesSeed);
  }

  private async ensureReLogs() {
    const count = await this.reLogModel.estimatedDocumentCount().exec();
    if (count > 0) return;
    await this.reLogModel.insertMany(reEngagementLogsSeed);
  }

  async listSequences() {
    await this.ensureSequences();
    return this.sequenceModel.find().sort({ name: 1 }).lean().exec();
  }

  async updateSequence(id: string, dto: UpdateAutomationSequenceDto) {
    await this.ensureSequences();
    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.track !== undefined) updates.track = dto.track;
    if (dto.steps !== undefined) updates.steps = dto.steps;
    if (dto.activeLeads !== undefined) updates.activeLeads = dto.activeLeads;
    if (dto.lastTriggered !== undefined)
      updates.lastTriggered = new Date(dto.lastTriggered);

    const doc = await this.sequenceModel
      .findByIdAndUpdate(id, { $set: updates }, { new: true })
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Sequence not found');
    return doc;
  }

  async listAutomationLogs(params?: {
    leadId?: string;
    channel?: string;
    status?: string;
  }) {
    await this.ensureLogs();
    const filter: Record<string, string> = {};
    if (params?.leadId) filter.leadId = params.leadId;
    if (params?.channel) filter.channel = params.channel;
    if (params?.status) filter.status = params.status;

    return this.logModel.find(filter).sort({ sentAt: -1 }).lean().exec();
  }

  async listReEngagementRules() {
    await this.ensureRules();
    return this.ruleModel.find().sort({ name: 1 }).lean().exec();
  }

  async updateReEngagementRule(id: string, enabled: boolean) {
    await this.ensureRules();
    const doc = await this.ruleModel
      .findByIdAndUpdate(id, { $set: { enabled } }, { new: true })
      .lean()
      .exec();
    if (!doc) throw new NotFoundException('Rule not found');
    return doc;
  }

  async listReEngagementLogs() {
    await this.ensureReLogs();
    return this.reLogModel.find().sort({ triggeredAt: -1 }).lean().exec();
  }
}
