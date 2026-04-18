import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PipelineStage } from '../../pipeline/schemas/pipeline-stage.schema';
import { User } from '../../users/schemas/user.schema';

export type LeadDocument = Lead & Document;

@Schema({ timestamps: true })
export class Lead {
  @Prop({ required: true })
  name!: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  company?: string;

  @Prop({ default: 'Other' })
  source!: string;

  @Prop({ default: 'Not Ready' })
  track!: string;

  @Prop({ default: 'Gap Nurture' })
  stage!: string;

  @Prop({ type: Types.ObjectId, ref: PipelineStage.name })
  pipelineStageId?: Types.ObjectId;

  @Prop({ default: 'New' })
  status!: string;

  @Prop({ default: 0 })
  score!: number;

  @Prop({ type: Array, default: [] })
  scoreDimensions!: Array<{ name: string; score: number; max: number }>;

  /** WhatsApp bot + scorecard (synced with CRM `leads` collection) */
  @Prop()
  botState?: string;

  @Prop({ type: Object, default: {} })
  scorecardAnswers?: Record<string, unknown>;

  @Prop()
  totalScore?: number;

  @Prop()
  readinessBand?: 'franchise_ready' | 'recruitment_only' | 'not_ready';

  @Prop()
  scoringCompletedAt?: Date;

  @Prop()
  intentSignal?: string;

  @Prop()
  scorecardPdfUrl?: string;

  @Prop({ type: Object })
  scorecardData?: Record<string, unknown>;

  @Prop()
  scorecardSentAt?: Date;

  /** Outbound VAPI dial attempts for no-answer / failed (max 2 before nurture). */
  @Prop({ default: 0 })
  voiceNoAnswerCount!: number;

  @Prop()
  voiceCallbackAt?: Date;

  @Prop({ type: Object })
  discoveryCall?: {
    scheduledAt?: Date;
    endTime?: Date;
    meetingLink?: string;
    meetLink?: string;
    calendlyEventUri?: string;
    googleEventId?: string;
    outlookEventId?: string;
    status?: 'scheduled' | 'cancelled' | 'completed';
    completedAt?: Date;
    bookedVia?: 'crm_bot' | 'crm_voice' | 'ghl_link';
    reminderJobIds?: string[];
  };

  /** Manual post-call debrief (single submission). */
  /** Generated proposal / MOM PDFs (path `documentType` avoids Mongoose reserved `type`). */
  @Prop({
    type: [
      {
        documentType: { type: String, enum: ['proposal', 'mom'], required: true },
        url: { type: String, required: true },
        generatedAt: { type: Date, required: true },
        status: {
          type: String,
          enum: ['pending_review', 'approved', 'sent', 'signed'],
          default: 'pending_review',
        },
        proposalViewToken: { type: String },
        /** PDF prepared for signing (signature area on last page). */
        unsignedPdfUrl: { type: String },
        signedPdfUrl: { type: String },
        signedAt: { type: Date },
        proposalSentAt: { type: Date },
        proposalViewCount: { type: Number, default: 0 },
        proposalLastViewedAt: { type: Date },
      },
    ],
    default: [],
  })
  documents!: Array<{
    _id?: Types.ObjectId;
    documentType: 'proposal' | 'mom';
    url: string;
    generatedAt: Date;
    status: 'pending_review' | 'approved' | 'sent' | 'signed';
    proposalViewToken?: string;
    unsignedPdfUrl?: string;
    signedPdfUrl?: string;
    signedAt?: Date;
    proposalSentAt?: Date;
    proposalViewCount?: number;
    proposalLastViewedAt?: Date;
  }>;

  /** Set when the 48h proposal check-in WhatsApp is sent. */
  @Prop({ type: Date })
  proposalCheckinSentAt?: Date;

  /** After handling check-in reply alert (one-shot). */
  @Prop({ type: Date })
  proposalCheckinReplyAlertAt?: Date;

  @Prop({ type: Object })
  callNotes?: {
    outcome: string;
    serviceType?: string;
    engagementScope: string;
    priceDiscussed?: number;
    objections?: string;
    commitments?: string;
    consultantNotes: string;
    docRequired: string;
    nextStep: string;
    submittedBy?: Types.ObjectId;
    submittedAt?: Date;
  };

  /** Owning CRM user (preferred for permissions vs display string) */
  @Prop({ type: Types.ObjectId, ref: User.name })
  ownerId?: Types.ObjectId;

  @Prop()
  assignedTo?: string;

  @Prop()
  notes?: string;

  @Prop()
  lastActivity?: string;

  @Prop()
  lastActivityType?: string;

  @Prop({ default: 0 })
  stageDuration!: number;

  @Prop({ default: 0 })
  value!: number;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop()
  health?: string;

  @Prop()
  lostReason?: string;

  @Prop()
  lostAt?: Date;

  @Prop()
  waConversationId?: string;

  @Prop()
  metaLeadId?: string;

  @Prop()
  metaFormId?: string;

  @Prop()
  utmSource?: string;

  @Prop()
  utmMedium?: string;

  @Prop()
  utmCampaign?: string;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);

LeadSchema.index({ track: 1, stage: 1 });
LeadSchema.index({ ownerId: 1 });
LeadSchema.index({ pipelineStageId: 1 });
LeadSchema.index({ status: 1 });
LeadSchema.index({
  name: 'text',
  email: 'text',
  phone: 'text',
  company: 'text',
});
LeadSchema.index({ email: 1 }, { sparse: true });
