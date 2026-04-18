import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const BOT_STATES = [
  'NEW',
  'AWAITING_NAME',
  'AWAITING_EMAIL',
  'SCORING_Q1',
  'SCORING_Q2',
  'SCORING_Q3',
  'SCORING_Q4',
  'SCORING_Q5',
  'SCORED',
  'NURTURE',
  'BOOKING',
  'BOOKED',
  'DEAD',
] as const;

const ScoreAnswersSchema = new Schema(
  {
    capital: { type: Number, default: null },
    experience: { type: Number, default: null },
    location: { type: Number, default: null },
    commitment: { type: Number, default: null },
    timeline: { type: Number, default: null },
  },
  { _id: false },
);

const BotSessionSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
    state: {
      type: String,
      enum: BOT_STATES,
      default: 'NEW',
    },
    scoreAnswers: { type: ScoreAnswersSchema, default: () => ({}) },
    collectedName: { type: String },
    collectedEmail: { type: String },
    lastMessageAt: { type: Date },
    /** When the latest scoring (list/button) question was sent — used by nudge worker. */
    lastQuestionSentAt: { type: Date },
    /** Incremented after two scoring nudges without progress; also used for voice escalation. */
    retryCount: { type: Number, default: 0 },
    optedOut: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type BotSessionDocument = InferSchemaType<typeof BotSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BotSession: Model<BotSessionDocument> =
  mongoose.models.BotSession ??
  mongoose.model<BotSessionDocument>('BotSession', BotSessionSchema);
