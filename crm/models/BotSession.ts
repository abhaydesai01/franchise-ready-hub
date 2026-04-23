import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const GoalTrackerSchema = new Schema(
  {
    has_name: { type: Boolean, default: false },
    has_email: { type: Boolean, default: false },
    has_phone: { type: Boolean, default: false },
    score_capital: { type: Number, default: null },
    score_experience: { type: Number, default: null },
    score_location: { type: Number, default: null },
    score_commitment: { type: Number, default: null },
    score_timeline: { type: Number, default: null },
    discovery_booked: { type: Boolean, default: false },
    track_assigned: { type: String, default: null },
  },
  { _id: false },
);

const ScoringEvidenceSchema = new Schema(
  {
    capital: { type: String },
    experience: { type: String },
    location: { type: String },
    commitment: { type: String },
    timeline: { type: String },
  },
  { _id: false },
);

const BotSessionSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    goalTracker: { type: GoalTrackerSchema, default: () => ({}) },
    channelPreference: {
      type: String,
      enum: ['whatsapp', 'voice', 'email'],
      default: 'whatsapp',
    },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    lastIntentAt: { type: Date },
    lastIntent: { type: String },
    isInvestor: { type: Boolean, default: false },
    scoringEvidence: { type: ScoringEvidenceSchema, default: () => ({}) },
    collectedName: { type: String },
    collectedEmail: { type: String },
    lastMessageAt: { type: Date },
    lastQuestionSentAt: { type: Date },
    lastQuestionAsked: { type: String, default: null },
    lastAssistantText: { type: String, default: null },
    repeatCount: { type: Number, default: 0 },
    retryCount: { type: Number, default: 0 },
    optedOut: { type: Boolean, default: false },

    // Structured onboarding flow (see lib/agent/flowEngine.ts for the spec).
    currentStep: { type: String, default: null },
    flowAnswers: { type: Schema.Types.Mixed, default: () => ({}) },
    flowCompletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type BotSessionDocument = InferSchemaType<typeof BotSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BotSession: Model<BotSessionDocument> =
  mongoose.models.BotSession ??
  mongoose.model<BotSessionDocument>('BotSession', BotSessionSchema);
