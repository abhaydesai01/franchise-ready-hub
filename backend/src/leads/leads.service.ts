import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from './schemas/lead.schema';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { PipelineService } from '../pipeline/pipeline.service';
import { UsersService } from '../users/users.service';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';
import {
  AutomationLog,
  AutomationLogDocument,
} from '../automation/schemas/automation-log.schema';
import { AppSettings, SettingsDocument } from '../settings/schemas/settings.schema';
import { ActivitiesService } from '../activities/activities.service';
import { PostCallPipelineService } from './post-call-pipeline.service';
import type { PostCallNotesDto } from './dto/post-call-notes.dto';
import { ProposalSendService } from '../proposals/proposal-send.service';

export interface LeadListResult {
  leads: Array<Lead & { _id: string }>;
  total: number;
}

@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(AutomationLog.name)
    private readonly automationLogModel: Model<AutomationLogDocument>,
    @InjectModel(AppSettings.name)
    private readonly settingsModel: Model<SettingsDocument>,
    private readonly pipelineService: PipelineService,
    private readonly usersService: UsersService,
    private readonly activitiesService: ActivitiesService,
    private readonly postCallPipeline: PostCallPipelineService,
    private readonly proposalSend: ProposalSendService,
  ) {}

  private async getThresholds() {
    const settings = await this.settingsModel
      .findOne()
      .lean<AppSettings | null>()
      .exec();
    return settings?.thresholds ?? { notReadyBelow: 40, franchiseReadyMin: 40, franchiseReadyMax: 100 };
  }

  private deriveTrackByScore(
    score: number,
    thresholds: { notReadyBelow: number; franchiseReadyMin: number },
  ): 'Not Ready' | 'Franchise Ready' | 'Recruitment Only' {
    if (score < thresholds.notReadyBelow) return 'Not Ready';
    if (score >= thresholds.franchiseReadyMin) return 'Franchise Ready';
    return 'Recruitment Only';
  }

  private repScopeFilter(user: CurrentUserPayload): Record<string, unknown> {
    if (user.role === 'admin' || user.role === 'manager') {
      return {};
    }
    const oid = new Types.ObjectId(user._id);
    return {
      $or: [
        { ownerId: oid },
        {
          $and: [
            { $or: [{ ownerId: { $exists: false } }, { ownerId: null }] },
            { assignedTo: user.name },
          ],
        },
      ],
    };
  }

  private assertLeadAccess(
    lead: Lead & { _id: string },
    user: CurrentUserPayload,
  ) {
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

  async list(
    user: CurrentUserPayload,
    params?: {
      track?: string;
      stage?: string;
      search?: string;
      assignedTo?: string;
      ownerId?: string;
      status?: string;
      pipelineStageId?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<LeadListResult> {
    const filter: Record<string, unknown> = {
      ...this.repScopeFilter(user),
    };

    if (params?.track) {
      filter.track = params.track;
    }
    if (params?.stage) {
      filter.stage = params.stage;
    }
    if (params?.assignedTo) {
      filter.assignedTo = params.assignedTo;
    }
    if (params?.ownerId) {
      filter.ownerId = new Types.ObjectId(params.ownerId);
    }
    if (params?.status) {
      filter.status = params.status;
    }
    if (params?.pipelineStageId) {
      filter.pipelineStageId = new Types.ObjectId(params.pipelineStageId);
    }
    if (params?.search) {
      filter.$text = { $search: params.search };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;

    const [items, total] = await Promise.all([
      this.leadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<Array<Lead & { _id: string }>>()
        .exec(),
      this.leadModel.countDocuments(filter).exec(),
    ]);

    return { leads: items, total };
  }

  async findById(
    id: string,
    user: CurrentUserPayload,
  ): Promise<Lead & { _id: string }> {
    const lead = await this.leadModel
      .findById(id)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    this.assertLeadAccess(lead, user);
    return lead;
  }

  async create(
    dto: CreateLeadDto,
    user: CurrentUserPayload,
  ): Promise<Lead & { _id: string }> {
    let pipelineStageId: Types.ObjectId | undefined;
    let track = 'Not Ready';
    let stage = 'Gap Nurture';
    const score = Math.max(0, Math.min(100, Number(dto.score ?? 0)));

    if (dto.pipelineStageId) {
      const ps = await this.pipelineService.findById(dto.pipelineStageId);
      if (!ps) {
        throw new BadRequestException('Invalid pipelineStageId');
      }
      pipelineStageId = new Types.ObjectId(dto.pipelineStageId);
      track = ps.track;
      stage = ps.name;
    } else {
      const thresholds = await this.getThresholds();
      const targetTrack = this.deriveTrackByScore(score, thresholds);
      const def =
        (await this.pipelineService.findFirstStageForTrack(targetTrack)) ??
        (await this.pipelineService.findDefaultStageForNewLead());
      pipelineStageId = new Types.ObjectId(String(def._id));
      track = def.track;
      stage = def.name;
    }

    const ownerId =
      dto.ownerId && (user.role === 'admin' || user.role === 'manager')
        ? new Types.ObjectId(dto.ownerId)
        : new Types.ObjectId(user._id);

    let assignedTo = dto.assignedTo;
    if (!assignedTo) {
      assignedTo = user.name;
    }

    const { pipelineStageId: _dtoStage, ownerId: _dtoOwner, ...restDto } = dto;
    void _dtoStage;
    void _dtoOwner;

    const created = await this.leadModel.create({
      ...restDto,
      pipelineStageId,
      track,
      stage,
      ownerId,
      assignedTo,
      source: dto.source ?? 'Other',
      status: 'New',
      score,
      scoreDimensions: [
        { name: 'Capital', score: 0, max: 25 },
        { name: 'Experience', score: 0, max: 25 },
        { name: 'Location', score: 0, max: 20 },
        { name: 'Commitment', score: 0, max: 15 },
        { name: 'Timeline', score: 0, max: 15 },
      ],
      lastActivity: 'Just now',
      lastActivityType: 'Lead added',
      stageDuration: 0,
      tags: [],
      value: dto.value ?? 0,
    });

    return created.toObject() as unknown as Lead & { _id: string };
  }

  async update(
    id: string,
    dto: UpdateLeadDto,
    user: CurrentUserPayload,
  ): Promise<Lead & { _id: string }> {
    await this.findById(id, user);

    const { pipelineStageId: pid, ownerId: newOwnerId, ...scalarFields } = dto;
    const $set: Record<string, unknown> = {
      ...scalarFields,
      updatedAt: new Date(),
    };

    if (pid) {
      const ps = await this.pipelineService.findById(pid);
      if (!ps) {
        throw new BadRequestException('Invalid pipelineStageId');
      }
      $set.pipelineStageId = new Types.ObjectId(pid);
      $set.track = ps.track;
      $set.stage = ps.name;
    }

    if (dto.score !== undefined && !pid && dto.track === undefined && dto.stage === undefined) {
      const thresholds = await this.getThresholds();
      const targetTrack = this.deriveTrackByScore(
        Math.max(0, Math.min(100, Number(dto.score))),
        thresholds,
      );
      const nextStage = await this.pipelineService.findFirstStageForTrack(targetTrack);
      if (nextStage) {
        $set.track = nextStage.track;
        $set.stage = nextStage.name;
        $set.pipelineStageId = new Types.ObjectId(String(nextStage._id));
      }
    }

    if (newOwnerId) {
      if (user.role !== 'admin' && user.role !== 'manager') {
        throw new ForbiddenException(
          'Only managers or admins can reassign ownerId via PATCH',
        );
      }
      $set.ownerId = new Types.ObjectId(newOwnerId);
      const u = await this.usersService.findById(newOwnerId);
      $set.assignedTo = u.name;
    }

    const updated = await this.leadModel
      .findByIdAndUpdate(id, { $set }, { new: true })
      .lean<(Lead & { _id: string }) | null>()
      .exec();

    if (!updated) {
      throw new NotFoundException('Lead not found');
    }

    return updated;
  }

  async updateStage(
    id: string,
    body: { stage?: string; track?: string; pipelineStageId?: string },
    user: CurrentUserPayload,
  ): Promise<Lead & { _id: string }> {
    await this.findById(id, user);

    let track: string | undefined = body.track;
    let stage: string;
    let pipelineStageId: Types.ObjectId | undefined;

    if (body.pipelineStageId) {
      const ps = await this.pipelineService.findById(body.pipelineStageId);
      if (!ps) {
        throw new BadRequestException('Invalid pipelineStageId');
      }
      pipelineStageId = new Types.ObjectId(body.pipelineStageId);
      track = ps.track;
      stage = ps.name;
    } else if (body.stage) {
      stage = body.stage;
      pipelineStageId = undefined;
    } else {
      throw new BadRequestException('Provide stage or pipelineStageId');
    }

    const $set: Record<string, unknown> = {
      stage,
      lastActivity: 'Just now',
      lastActivityType: 'Stage changed',
      stageDuration: 0,
      updatedAt: new Date(),
    };

    if (track !== undefined) {
      $set.track = track;
    }
    if (pipelineStageId) {
      $set.pipelineStageId = pipelineStageId;
    }

    const updated = await this.leadModel
      .findByIdAndUpdate(id, { $set }, { new: true })
      .lean<(Lead & { _id: string }) | null>()
      .exec();

    if (!updated) {
      throw new NotFoundException('Lead not found');
    }

    return updated;
  }

  async updateStatus(
    id: string,
    status: string,
    lostReason: string | undefined,
    user: CurrentUserPayload,
  ): Promise<Lead & { _id: string }> {
    await this.findById(id, user);

    const $set: Record<string, unknown> = {
      status,
      lastActivity: 'Just now',
      lastActivityType: 'Status changed',
      updatedAt: new Date(),
    };

    if (status === 'Dead' || status === 'lost') {
      $set.lostReason = lostReason ?? null;
      $set.lostAt = new Date();
    } else {
      $set.lostReason = null;
      $set.lostAt = null;
    }

    const updated = await this.leadModel
      .findByIdAndUpdate(id, { $set }, { new: true })
      .lean<(Lead & { _id: string }) | null>()
      .exec();

    if (!updated) {
      throw new NotFoundException('Lead not found');
    }

    return updated;
  }

  async updateOwner(
    id: string,
    ownerId: string,
    actor: CurrentUserPayload,
  ): Promise<Lead & { _id: string }> {
    if (actor.role !== 'admin' && actor.role !== 'manager') {
      throw new ForbiddenException(
        'Only managers or admins can reassign leads',
      );
    }

    await this.findById(id, actor);

    const newOwner = await this.usersService.findById(ownerId);

    const updated = await this.leadModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            ownerId: new Types.ObjectId(ownerId),
            assignedTo: newOwner.name,
            lastActivity: 'Just now',
            lastActivityType: 'Owner changed',
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean<(Lead & { _id: string }) | null>()
      .exec();

    if (!updated) {
      throw new NotFoundException('Lead not found');
    }

    return updated;
  }

  async markDiscoveryCallComplete(
    id: string,
    user: CurrentUserPayload,
  ): Promise<Lead & { _id: string }> {
    const lead = await this.findById(id, user);
    const dc = lead.discoveryCall;
    if (!dc) {
      throw new BadRequestException('No discovery call on this lead.');
    }
    if (dc.status === 'cancelled') {
      throw new BadRequestException('Discovery call was cancelled.');
    }
    if (dc.status === 'completed') {
      return lead;
    }
    if (dc.status !== 'scheduled') {
      throw new BadRequestException(
        'Only a scheduled discovery call can be marked complete.',
      );
    }

    const updated = await this.leadModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            'discoveryCall.status': 'completed',
            'discoveryCall.completedAt': new Date(),
            lastActivity: 'Just now',
            lastActivityType: 'Stage changed',
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean<(Lead & { _id: string }) | null>()
      .exec();

    if (!updated) {
      throw new NotFoundException('Lead not found');
    }

    return updated;
  }

  async submitPostCallNotes(
    id: string,
    dto: PostCallNotesDto,
    user: CurrentUserPayload,
  ): Promise<{
    lead: Lead & { _id: string };
    docTriggered: 'proposal' | 'mom' | null;
  }> {
    const lead = await this.findById(id, user);
    const st = lead.discoveryCall?.status;
    if (st !== 'scheduled' && st !== 'completed') {
      throw new BadRequestException(
        'Post-call notes require a scheduled or completed discovery call.',
      );
    }
    if (st === 'scheduled') {
      throw new BadRequestException(
        'Mark the call as done before submitting post-call notes.',
      );
    }
    const existing = (lead as Lead & { callNotes?: { submittedAt?: Date } })
      .callNotes;
    if (existing?.submittedAt) {
      throw new BadRequestException('Post-call notes were already submitted.');
    }

    const callNotes = {
      outcome: dto.outcome,
      serviceType:
        dto.outcome === 'not_interested' ? undefined : dto.serviceType,
      engagementScope: dto.engagementScope,
      priceDiscussed: dto.priceDiscussed,
      objections: dto.objections?.trim() || undefined,
      commitments: dto.commitments?.trim() || undefined,
      consultantNotes: dto.consultantNotes,
      docRequired: dto.docRequired,
      nextStep: dto.nextStep,
      submittedBy: new Types.ObjectId(user._id),
      submittedAt: new Date(),
    };

    const updated = await this.leadModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            callNotes,
            stage: 'post_call',
            lastActivity: 'Just now',
            lastActivityType: 'post_call_notes_submitted',
            updatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean<(Lead & { _id: string }) | null>()
      .exec();

    if (!updated) {
      throw new NotFoundException('Lead not found');
    }

    await this.activitiesService.createForLead(id, {
      type: 'post_call_notes_submitted',
      description: `Post-call outcome: ${dto.outcome}. Next step: ${dto.nextStep.slice(0, 240)}`,
      addedBy: user.name,
    });

    let docTriggered: 'proposal' | 'mom' | null = null;
    if (dto.docRequired === 'proposal') {
      await this.postCallPipeline.enqueueProposalGeneration(id);
      docTriggered = 'proposal';
    } else if (dto.docRequired === 'mom') {
      await this.postCallPipeline.enqueueMomGeneration(id);
      docTriggered = 'mom';
    }

    return { lead: updated, docTriggered };
  }

  async approveAndSendDocument(
    leadId: string,
    documentEntryId: string,
    user: CurrentUserPayload,
  ): Promise<Lead & { _id: string }> {
    await this.findById(leadId, user);

    try {
      new Types.ObjectId(documentEntryId);
    } catch {
      throw new BadRequestException('Invalid document id');
    }

    const lead = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const doc = (lead.documents ?? []).find(
      (d) => String((d as { _id?: Types.ObjectId })._id) === documentEntryId,
    );
    if (!doc) {
      throw new NotFoundException('Document not found');
    }
    if (doc.status !== 'pending_review') {
      throw new BadRequestException('Document is not pending review');
    }

    if (doc.documentType === 'proposal') {
      await this.proposalSend.approveAndSendProposal(leadId, documentEntryId, user);
    } else {
      await this.proposalSend.approveAndSendMom(leadId, documentEntryId, user);
    }

    const fresh = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!fresh) {
      throw new NotFoundException('Lead not found');
    }
    return fresh;
  }

  async journey(
    id: string,
    user: CurrentUserPayload,
  ): Promise<
    Array<{
      id: string;
      leadId: string;
      type: string;
      title: string;
      description: string;
      timestamp: string;
      source: 'crm' | 'automation' | 'whatsapp';
      channel?: 'whatsapp' | 'email' | 'voice' | 'web';
    }>
  > {
    const lead = await this.findById(id, user);
    const leadId = String(lead._id);

    const [activities, waLogs] = await Promise.all([
      this.activityModel
        .find({ leadId })
        .sort({ timestamp: 1 })
        .lean<Array<Activity & { _id: string }>>()
        .exec(),
      this.automationLogModel
        .find({ leadId, channel: 'WhatsApp' })
        .sort({ sentAt: 1 })
        .lean<Array<AutomationLog & { _id: string }>>()
        .exec(),
    ]);

    const mapActivityType = (type: string) => {
      if (type === 'lead_added') return 'lead_created';
      if (type === 'wa_sent') return 'wa_message_sent';
      if (type === 'note_added') return 'note_added';
      return type;
    };

    const fromActivities = activities.map((a) => ({
      id: String(a._id),
      leadId: String(a.leadId),
      type: mapActivityType(a.type),
      title:
        a.type === 'calendly_booking_created'
          ? 'Discovery call booked'
          : a.type === 'calendly_booking_cancelled'
            ? 'Discovery call cancelled'
            : a.type === 'calendly_rescheduled'
              ? 'Discovery call rescheduled'
              : a.type === 'scorecard_generated'
                ? 'Scorecard sent'
                : a.type === 'voice_call'
                  ? 'Voice call'
                  : a.type === 'post_call_notes_submitted'
                    ? 'Post-call notes submitted'
                    : a.type === 'document_generated'
                      ? 'Document generated'
                      : a.type === 'document_approved_sent'
                        ? 'Document approved & sent'
                        : a.type === 'proposal_sent'
                          ? 'Proposal sent'
                          : a.type === 'proposal_signed'
                            ? 'Proposal signed'
                            : a.type === 'lead_added'
                    ? 'Lead Created'
                    : a.type === 'wa_sent'
                      ? 'WhatsApp Sent'
                      : a.type === 'note_added'
                        ? 'Note Added'
                        : a.type.replace(/_/g, ' '),
      description: a.description,
      timestamp: a.timestamp,
      source:
        a.type === 'wa_sent'
          ? ('whatsapp' as const)
          : ('crm' as const),
      ...(a.type === 'wa_sent' ? { channel: 'whatsapp' as const } : {}),
      ...(a.type === 'voice_call' ? { channel: 'voice' as const } : {}),
    }));

    const fromAutomation = waLogs.map((l) => ({
      id: `auto_${String(l._id)}`,
      leadId: String(l.leadId),
      type: 'wa_template_sent',
      title: 'Automation WhatsApp',
      description: `${l.sequenceName} step ${l.step} • ${l.status}`,
      timestamp: new Date(l.sentAt).toISOString(),
      source: 'automation' as const,
      channel: 'whatsapp' as const,
    }));

    return [...fromActivities, ...fromAutomation].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  async whatsappConversation(
    id: string,
    user: CurrentUserPayload,
  ): Promise<{
    leadId: string;
    phoneNumber: string;
    totalMessages: number;
    lastMessageAt: string;
    isActive: boolean;
    messages: Array<{
      id: string;
      leadId: string;
      direction: 'inbound' | 'outbound';
      type:
        | 'text'
        | 'image'
        | 'document'
        | 'template'
        | 'button_reply'
        | 'list_reply'
        | 'location'
        | 'contact';
      body: string;
      templateName?: string;
      status: 'sent' | 'delivered' | 'read' | 'failed';
      timestamp: string;
      agentName?: string;
    }>;
  } | null> {
    const lead = await this.findById(id, user);
    const leadId = String(lead._id);

    const [activities, waLogs] = await Promise.all([
      this.activityModel
        .find({ leadId, type: 'wa_sent' })
        .sort({ timestamp: 1 })
        .lean<Array<Activity & { _id: string }>>()
        .exec(),
      this.automationLogModel
        .find({ leadId, channel: 'WhatsApp' })
        .sort({ sentAt: 1 })
        .lean<Array<AutomationLog & { _id: string }>>()
        .exec(),
    ]);

    const activityMsgs = activities.map((a) => ({
      id: String(a._id),
      leadId,
      direction: 'outbound' as const,
      type: 'text' as const,
      body: a.description,
      status: 'sent' as const,
      timestamp: a.timestamp,
      agentName: a.addedBy ?? 'CRM',
    }));

    const mapStatus = (status: string) => {
      if (status === 'Opened') return 'read' as const;
      if (status === 'Failed') return 'failed' as const;
      if (status === 'Pending') return 'delivered' as const;
      return 'sent' as const;
    };

    const logMsgs = waLogs.map((l) => ({
      id: `auto_${String(l._id)}`,
      leadId,
      direction: 'outbound' as const,
      type: 'template' as const,
      body: `${l.sequenceName} step ${l.step}`,
      templateName: l.sequenceName,
      status: mapStatus(l.status),
      timestamp: new Date(l.sentAt).toISOString(),
      agentName: 'Automation',
    }));

    const messages = [...activityMsgs, ...logMsgs].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    if (!messages.length) return null;

    return {
      leadId,
      phoneNumber: lead.phone ?? '',
      totalMessages: messages.length,
      lastMessageAt: messages[messages.length - 1].timestamp,
      isActive: String(lead.status ?? '').toLowerCase() !== 'dead',
      messages,
    };
  }

  async healthMap(
    user: CurrentUserPayload,
  ): Promise<
    Record<
      string,
      {
        leadId: string;
        temperature: 'hot' | 'warm' | 'cold' | 'dead';
        riskScore: number;
        daysSinceContact: number;
        responseRate: number;
        engagementTrend: 'rising' | 'stable' | 'declining';
        sla: {
          firstResponseTime: number | null;
          firstResponseSLA: number;
          firstResponseState: 'on_track' | 'at_risk' | 'breached';
          lastFollowUpAt: string | null;
          followUpCadenceDays: number;
          followUpState: 'on_track' | 'at_risk' | 'breached';
          averageResponseTime: number;
        };
        alerts: string[];
      }
    >
  > {
    const { leads } = await this.list(user, { page: 1, limit: 1000 });
    const thresholds = await this.getThresholds();
    const now = Date.now();
    const out: Record<string, any> = {};

    for (const lead of leads) {
      const updated = new Date((lead as any).updatedAt ?? (lead as any).createdAt ?? now).getTime();
      const daysSinceContact = Math.max(0, Math.floor((now - updated) / (1000 * 60 * 60 * 24)));
      const score = Number(lead.score ?? 0);
      const isDead = String(lead.status ?? '').toLowerCase() === 'dead';
      const temperature = isDead
        ? 'dead'
        : score >= thresholds.franchiseReadyMin
          ? 'hot'
          : score >= thresholds.notReadyBelow
            ? 'warm'
            : 'cold';
      const riskScore = Math.min(100, Math.max(0, 100 - score + daysSinceContact * 6));
      const followUpState =
        daysSinceContact >= 4
          ? 'breached'
          : daysSinceContact >= 2
            ? 'at_risk'
            : 'on_track';

      out[String(lead._id)] = {
        leadId: String(lead._id),
        temperature,
        riskScore,
        daysSinceContact,
        responseRate: Math.max(0, Math.min(1, score / 100)),
        engagementTrend: daysSinceContact >= 3 ? 'declining' : daysSinceContact === 0 ? 'rising' : 'stable',
        sla: {
          firstResponseTime: null,
          firstResponseSLA: 120,
          firstResponseState: followUpState === 'breached' ? 'breached' : 'on_track',
          lastFollowUpAt: (lead as any).updatedAt ? new Date((lead as any).updatedAt).toISOString() : null,
          followUpCadenceDays: 2,
          followUpState,
          averageResponseTime: Math.max(10, daysSinceContact * 30),
        },
        alerts: [],
      };
    }

    return out;
  }
}
