import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
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
import { CalendarService } from '../calendar/calendar.service';
import { getSingletonBullConnection } from '../queues/redis-connection';
import { applyVoiceEnrichmentFromVaaniApis } from '../voice/apply-voice-enrichment';
import { VaaniService } from '../voice/vaani.service';
import { GeminiVoiceScoringService } from '../voice/gemini-voice-scoring.service';
import { VoicePipelineSyncService } from '../voice/voice-pipeline-sync.service';
import { VoiceAdHocCalendarService } from '../voice/voice-ad-hoc-calendar.service';
import type { VaaniTestCallDto } from './dto/vaani-test-call.dto';
import { WhatsappInboxService } from '../whatsapp/whatsapp-inbox.service';

export interface LeadListResult {
  leads: Array<Lead & { _id: string }>;
  total: number;
}

@Injectable()
export class LeadsService {
  private readonly log = new Logger(LeadsService.name);

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
    private readonly calendar: CalendarService,
    private readonly vaani: VaaniService,
    private readonly geminiVoiceScoring: GeminiVoiceScoringService,
    private readonly voicePipelineSync: VoicePipelineSyncService,
    private readonly voiceAdHocCalendar: VoiceAdHocCalendarService,
    private readonly whatsappInbox: WhatsappInboxService,
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

  private isAdminOrManager(user: CurrentUserPayload): boolean {
    const r = String(user.role ?? '').toLowerCase();
    return r === 'admin' || r === 'manager';
  }

  private repScopeFilter(user: CurrentUserPayload): Record<string, unknown> {
    if (this.isAdminOrManager(user)) {
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
    if (this.isAdminOrManager(user)) return;
    const oid = String(user._id);
    const ownerMatches =
      lead.ownerId &&
      (typeof lead.ownerId === 'string'
        ? lead.ownerId === oid
        : String(lead.ownerId) === oid);
    const legacyAssigned = !lead.ownerId && lead.assignedTo === user.name;
    // Unowned + unassigned leads (e.g. WhatsApp inbound from Freddy) are accessible
    // to any authenticated user until a human claims them.
    const unclaimed = !lead.ownerId && !lead.assignedTo;
    if (!ownerMatches && !legacyAssigned && !unclaimed) {
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
      dto.ownerId && this.isAdminOrManager(user)
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
      if (!this.isAdminOrManager(user)) {
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

    // Merge Freddy bot messages from freddy_messages collection
    const freddyMsgs = await this.whatsappInbox.getMessagesByLeadId(leadId);
    const freddyMapped = freddyMsgs.map((m) => ({
      id: `freddy_${m.id}`,
      leadId,
      direction: m.direction,
      type: 'text' as const,
      body: m.body,
      status: 'sent' as const,
      timestamp: m.timestamp,
      agentName: m.direction === 'outbound' ? 'Freddy Bot' : undefined,
    }));

    const messages = [...activityMsgs, ...logMsgs, ...freddyMapped].sort(
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

  /**
   * CRM: trigger a real Vaani outbound call, cache slots, append voiceCalls (same as voice worker / CLI script).
   */
  async triggerVaaniTestCall(
    id: string,
    user: CurrentUserPayload,
    body?: VaaniTestCallDto,
  ): Promise<Lead & { _id: string }> {
    const lead = await this.findById(id, user);
    const cfg = await this.vaani.getConfig();
    if (!cfg) {
      throw new BadRequestException(
        'Vaani is not configured. Set VAANI_API_KEY and VAANI_AGENT_ID (optional outbound) or save in Settings → Integrations.',
      );
    }
    const settings = await this.settingsModel.findOne().lean().exec();
    const maxAttempts = Math.min(
      5,
      Math.max(1, (settings as { maxVoiceAttempts?: number } | null)?.maxVoiceAttempts ?? 2),
    );
    if ((lead.voiceCalls?.length ?? 0) >= maxAttempts) {
      throw new BadRequestException(
        `This lead already has ${maxAttempts} voice call attempt(s) (max in Settings).`,
      );
    }
    const raw =
      (body?.phoneOverride?.trim() && body.phoneOverride.trim().length > 0
        ? body.phoneOverride.trim()
        : lead.phone) ?? '';
    if (!raw || raw.replace(/\D/g, '').length < 10) {
      throw new BadRequestException(
        'A valid phone number is required (set on the lead or pass phoneOverride).',
      );
    }
    const contactNumber = this.toE164ForVoice(raw);

    let slotsString: string;
    try {
      const slots = await this.calendar.getAvailableSlots('voice', 3);
      await this.calendar.cacheVoiceSlots(id, slots);
      slotsString = slots
        .map((s) => `Option ${s.index}: ${s.label}`)
        .join(', ');
    } catch {
      slotsString =
        'Option 1: morning, Option 2: afternoon, Option 3: evening (set Calendar in Settings for live slots)';
    }
    const branding = settings as
      | { branding?: { companyName?: string } }
      | null
      | undefined;
    const companyName =
      branding?.branding?.companyName?.trim() ||
      process.env.COMPANY_NAME ||
      'Franchise Ready';
    const { callId, dispatchId } = await this.vaani.triggerCall({
      leadId: id,
      contactNumber,
      leadName: lead.name,
      triggerReason: 'intro_no_response',
      readinessScore: Number(lead.totalScore ?? lead.score ?? 0),
      readinessBand: this.readinessBandForVoice(lead),
      availableSlots: slotsString,
      companyName,
    });
    const voiceCallEntry: Record<string, unknown> = {
      vaaniCallId: callId,
      triggeredAt: new Date(),
      triggerReason: 'intro_no_response',
      status: 'initiated',
    };
    if (dispatchId) voiceCallEntry['vaaniDispatchId'] = dispatchId;
    const updated = await this.leadModel
      .findByIdAndUpdate(
        id,
        { $push: { voiceCalls: voiceCallEntry } },
        { new: true },
      )
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!updated) {
      throw new NotFoundException('Lead not found');
    }
    await this.activitiesService.logVoiceCall(
      id,
      lead.name,
      `Vaani outbound from CRM (room: ${callId})`,
    );
    void this.schedulePostDispatchEnrichment(String(id), callId);
    return updated;
  }

  /**
   * Fetches `GET /api/call_details/{room}` and `GET /api/transcript/{room}` and persists on `voiceCalls[]`.
   */
  async refreshVoiceFromVaani(
    id: string,
    user: CurrentUserPayload,
    callId: string,
  ): Promise<Lead & { _id: string }> {
    const lead0 = await this.findById(id, user);
    const r = await applyVoiceEnrichmentFromVaaniApis(
      this.leadModel,
      this.vaani,
      id,
      callId,
    );
    if (r === 'not_configured') {
      throw new BadRequestException(
        'Vaani is not configured. Set API key and agent in Settings or env.',
      );
    }
    if (r === 'not_found') {
      throw new NotFoundException('That call is not linked to this lead.');
    }
    if (r === 'no_data') {
      throw new BadRequestException(
        'Vaani has no transcript or call details for this call yet. Try again shortly after the call ends.',
      );
    }
    if (r === 'updated') {
      await this.activitiesService.logVoiceCall(
        id,
        lead0.name,
        `Voice call ${callId} — synced from Vaani (transcript, entities, summary)`,
      );
      const g = await this.geminiVoiceScoring.applyFromVoiceEnrichment(id, callId);
      if (g === 'applied') {
        this.log.log(`Gemini scorecard applied for lead ${id} (call ${callId})`);
      }
      await this.voicePipelineSync.afterVoiceDataSaved(id, callId);
      await this.voiceAdHocCalendar.tryBookFromVoice(id, callId);
    }
    return this.findById(id, user);
  }

  private async schedulePostDispatchEnrichment(leadId: string, callId: string) {
    let q: Queue | null = null;
    try {
      const conn = getSingletonBullConnection();
      q = new Queue('voice-fallback', { connection: conn });
      const safeId = String(callId).replace(/[^A-Za-z0-9_\-]/g, '_');
      for (let i = 0; i < 5; i++) {
        await q.add(
          'vaani-enrich-call',
          { leadId, callId, attempt: i + 1 },
          {
            delay: 30_000 + i * 45_000,
            jobId: `vaani_enrich_${safeId}_${i + 1}`,
            removeOnComplete: true,
            attempts: 1,
          },
        );
      }
    } catch (e) {
      this.log.warn('Could not schedule Vaani post-dispatch sync (is REDIS_URL set?)', e);
    } finally {
      if (q) await q.close();
    }
  }

  /**
   * Flat list of all Vaani `voiceCalls[]` entries (newest first), scoped like `list()`.
   */
  async listVoiceCallActivity(
    user: CurrentUserPayload,
    params?: { page?: number; limit?: number; search?: string },
  ): Promise<{
    items: Array<{
      leadId: string;
      leadName: string;
      leadPhone: string;
      leadStage: string;
      leadTrack: string;
      call: Record<string, unknown>;
    }>;
    total: number;
  }> {
    const page = Math.max(1, params?.page ?? 1);
    const limit = Math.min(100, Math.max(1, params?.limit ?? 30));
    const matchStage = this.buildVoiceActivityMatch(
      user,
      params?.search,
    ) as Record<string, unknown>;
    const pipeline: any[] = [
      { $match: matchStage },
      { $unwind: '$voiceCalls' },
      { $sort: { 'voiceCalls.triggeredAt': -1 } },
      {
        $facet: {
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                leadId: { $toString: '$_id' },
                leadName: '$name',
                leadPhone: '$phone',
                leadStage: '$stage',
                leadTrack: '$track',
                call: '$voiceCalls',
              },
            },
          ],
          countArr: [{ $count: 'n' }],
        },
      },
    ];
    const agg = await this.leadModel.aggregate(pipeline).exec();
    const first = Array.isArray(agg) && agg[0] ? (agg[0] as { data: unknown; countArr: { n: number }[] }) : { data: [], countArr: [] };
    const items = (first.data ?? []) as Array<{
      leadId: string;
      leadName: string;
      leadPhone: string;
      leadStage: string;
      leadTrack: string;
      call: Record<string, unknown>;
    }>;
    const total = first.countArr?.[0]?.n ?? 0;
    return { items, total };
  }

  private buildVoiceActivityMatch(
    user: CurrentUserPayload,
    search?: string,
  ): Record<string, unknown> {
    const scope = this.repScopeFilter(user);
    /** Use $expr / $size so we never miss non-empty `voiceCalls` arrays. */
    const hasVoice: Record<string, unknown> = {
      $expr: { $gt: [{ $size: { $ifNull: ['$voiceCalls', []] } }, 0] },
    };
    const parts: Record<string, unknown>[] = [hasVoice];
    if (Object.keys(scope).length > 0) {
      parts.unshift(scope);
    }
    const t = search?.trim();
    if (t) {
      const safe = this.escapeRegExp(t);
      parts.push({
        $or: [
          { name: { $regex: safe, $options: 'i' } },
          { phone: { $regex: safe, $options: 'i' } },
        ],
      });
    }
    if (parts.length === 1) {
      return parts[0] as Record<string, unknown>;
    }
    return { $and: parts } as Record<string, unknown>;
  }

  private escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private toE164ForVoice(phone: string): string {
    const d = phone.replace(/\D/g, '');
    if (d.length >= 10 && d.startsWith('91')) return `+${d}`;
    if (d.length === 10) return `+91${d}`;
    if (phone.trim().startsWith('+')) return phone.trim();
    return `+${d}`;
  }

  private readinessBandForVoice(lead: Lead): string {
    const b = lead.readinessBand;
    if (!b) return 'pending';
    const map: Record<string, string> = {
      franchise_ready: 'Franchise Ready',
      recruitment_only: 'Recruitment Only',
      not_ready: 'Not Ready',
    };
    return map[b] ?? String(b);
  }

  /**
   * Removes a lead the user can access, plus in-scope activities and automation rows.
   * Best-effort free busy cancel if a discovery call exists.
   */
  async remove(
    id: string,
    user: CurrentUserPayload,
  ): Promise<{ ok: true }> {
    const lead = await this.findById(id, user);
    try {
      await this.calendar.cancelBooking(id);
    } catch {
      // No calendar booking, or not cancellable
    }
    await this.activityModel.deleteMany({ leadId: id });
    await this.automationLogModel.deleteMany({ leadId: id });

    // Cascade delete Freddy v2 session + conversation + legacy freddy_bot data.
    // These live in Mongo but aren't owned by the leads model, so we do it via
    // the raw connection.
    try {
      const conn = this.leadModel.db;
      const { Types } = await import('mongoose');
      const leadOid = new Types.ObjectId(id);
      const phoneVariants = this._phoneVariants(String(lead.phone ?? ''));
      await Promise.all([
        conn.collection('botsessions').deleteMany({
          $or: [{ leadId: leadOid }, { phone: { $in: phoneVariants } }],
        }),
        conn.collection('conversations').deleteMany({
          $or: [{ leadId: leadOid }, { phone: { $in: phoneVariants } }],
        }),
        conn.collection('freddy_sessions').deleteMany({
          $or: [{ lead_id: leadOid }, { phone: { $in: phoneVariants } }],
        }),
        conn.collection('freddy_messages').deleteMany({
          $or: [{ lead_id: leadOid }, { phone: { $in: phoneVariants } }],
        }),
      ]);
    } catch (e) {
      this.log.warn(`Cascade delete skipped for lead=${id}: ${String(e)}`);
    }

    const r = await this.leadModel.findByIdAndDelete(id).exec();
    if (!r) {
      throw new NotFoundException('Lead not found');
    }
    this.log.log(`Lead deleted id=${id}`);
    return { ok: true };
  }

  private _phoneVariants(phone: string): string[] {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (!digits) return phone ? [phone] : [];
    const variants = new Set([phone, digits, `+${digits}`]);
    if (digits.startsWith('91') && digits.length === 12) variants.add(digits.slice(2));
    return Array.from(variants);
  }

  async removeMany(
    leadIds: string[],
    user: CurrentUserPayload,
  ): Promise<{ ok: true; removed: number }> {
    let removed = 0;
    const errors: string[] = [];
    for (const id of leadIds) {
      try {
        await this.remove(id, user);
        removed += 1;
      } catch (e) {
        this.log.warn(`removeMany skip id=${id}`, e);
        errors.push(id);
      }
    }
    if (removed === 0 && errors.length > 0) {
      throw new ForbiddenException(
        'None of the selected leads could be deleted. You may not have permission to delete them.',
      );
    }
    return { ok: true, removed };
  }

  /**
   * Creates many leads; each row is a loose object (e.g. from CSV). Per-row errors do not block others.
   */
  async importMany(
    rows: unknown[],
    user: CurrentUserPayload,
  ): Promise<{
    created: number;
    failed: Array<{ index: number; name?: string; message: string }>;
  }> {
    const failed: Array<{ index: number; name?: string; message: string }> = [];
    let created = 0;
    if (!Array.isArray(rows) || rows.length > 500) {
      throw new BadRequestException('Import between 1 and 500 leads');
    }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        failed.push({ index: i, message: 'Invalid row' });
        continue;
      }
      const o = row as Record<string, unknown>;
      const name = String(
        o.name ?? o.Name ?? o.full_name ?? o.Full_name ?? '',
      ).trim();
      if (!name) {
        failed.push({ index: i, message: 'name is required' });
        continue;
      }
      const phone =
        o.phone != null
          ? String(o.phone)
          : o.Phone != null
            ? String(o.Phone)
            : o.mobile != null
              ? String(o.mobile)
              : undefined;
      const rawEmail =
        o.email != null
          ? String(o.email).trim()
          : o.Email != null
            ? String(o.Email).trim()
            : undefined;
      const email =
        rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
          ? rawEmail
          : undefined;
      const company =
        o.company != null
          ? String(o.company)
          : o.Company != null
            ? String(o.Company)
            : undefined;
      const source = String(
        o.source != null
          ? o.source
          : o.Source != null
            ? o.Source
            : o.lead_source ?? 'Other',
      );
      const notes =
        o.notes != null
          ? String(o.notes)
          : o.Notes != null
            ? String(o.Notes)
            : undefined;
      const dto: CreateLeadDto = {
        name,
        phone: phone?.replace(/\r/g, '').trim() || undefined,
        email: email as CreateLeadDto['email'],
        company: company || undefined,
        source: source || 'Other',
        notes: notes || undefined,
      };
      try {
        await this.create(dto, user);
        created += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        failed.push({ index: i, name, message: msg });
      }
    }
    return { created, failed };
  }
}
