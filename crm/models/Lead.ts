import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const ScoreDimensionSchema = new Schema(
  {
    name: { type: String, required: true },
    score: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  { _id: false },
);

/** Scorecard answers stored as flexible subdocument (validated in engine). */
const ScorecardAnswersSchema = new Schema(
  {
    capitalBand: { type: String },
    businessExperience: { type: String },
    targetLocation: { type: String },
    propertyStatus: { type: String },
    motivation: { type: String },
  },
  { _id: false, strict: false },
);

export const BOT_STATE_VALUES = [
  'WARM_INTRO',
  'COLLECT_NAME',
  'COLLECT_EMAIL',
  'COLLECT_PHONE',
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'Q5',
  'INTENT_SIGNAL',
  'SCORING',
  'SLOT_OFFER',
  'BOOKING_CONFIRMED',
] as const;

const LeadSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, index: true, sparse: true },
    email: { type: String, index: true, sparse: true },
    company: { type: String },
    source: { type: String, default: 'other' },
    track: { type: String, default: 'not_ready' },
    stage: { type: String, default: 'new' },
    pipelineStageId: { type: Schema.Types.ObjectId },
    status: { type: String, default: 'new' },
    score: { type: Number, default: 0 },
    scoreDimensions: { type: [ScoreDimensionSchema], default: [] },
    ownerId: { type: Schema.Types.ObjectId },
    assignedTo: { type: String },
    notes: { type: String },
    lastActivity: { type: String },
    lastActivityType: { type: String },
    stageDuration: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    health: { type: String },
    lostReason: { type: String },
    lostAt: { type: Date },
    metaLeadId: { type: String, sparse: true },
    metaFormId: { type: String },

    /** WhatsApp bot conversation state — source of truth for resume after crash. */
    botState: { type: String, index: true },
    scorecardAnswers: { type: ScorecardAnswersSchema, default: () => ({}) },
    totalScore: { type: Number },
    readinessBand: {
      type: String,
      enum: ['franchise_ready', 'recruitment_only', 'not_ready'],
    },
    scoringCompletedAt: { type: Date },
    intentSignal: { type: String },

    scorecardPdfUrl: { type: String },
    scorecardData: { type: Schema.Types.Mixed },
    scorecardSentAt: { type: Date },

    /** Outbound VAPI dial attempts (no-answer / failed); max 2 before nurture drip. */
    voiceNoAnswerCount: { type: Number, default: 0 },
    voiceCallbackAt: { type: Date },

    discoveryCall: {
      type: new Schema(
        {
          scheduledAt: { type: Date },
          endTime: { type: Date },
          meetingLink: { type: String },
          calendlyEventUri: { type: String },
          status: {
            type: String,
            enum: ['scheduled', 'cancelled', 'completed'],
          },
          completedAt: { type: Date },
        },
        { _id: false },
      ),
      default: undefined,
    },

    callNotes: {
      type: new Schema(
        {
          outcome: { type: String, required: true },
          serviceType: { type: String },
          engagementScope: { type: String, required: true },
          priceDiscussed: { type: Number },
          objections: { type: String },
          commitments: { type: String },
          consultantNotes: { type: String, required: true },
          docRequired: { type: String, required: true },
          nextStep: { type: String, required: true },
          submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          submittedAt: { type: Date },
        },
        { _id: false },
      ),
      default: undefined,
    },

    documents: {
      type: [
        new Schema(
          {
            documentType: {
              type: String,
              enum: ['proposal', 'mom'],
              required: true,
            },
            url: { type: String, required: true },
            generatedAt: { type: Date, required: true },
            status: {
              type: String,
              enum: ['pending_review', 'approved', 'sent', 'signed'],
              default: 'pending_review',
            },
            proposalViewToken: { type: String },
            unsignedPdfUrl: { type: String },
            signedPdfUrl: { type: String },
            signedAt: { type: Date },
            proposalSentAt: { type: Date },
            proposalViewCount: { type: Number },
            proposalLastViewedAt: { type: Date },
          },
          { _id: true },
        ),
      ],
      default: [],
    },

    proposalCheckinSentAt: { type: Date },
    proposalCheckinReplyAlertAt: { type: Date },
  },
  { timestamps: true },
);

export type LeadDocument = InferSchemaType<typeof LeadSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Lead: Model<LeadDocument> =
  mongoose.models.Lead ?? mongoose.model<LeadDocument>('Lead', LeadSchema);
