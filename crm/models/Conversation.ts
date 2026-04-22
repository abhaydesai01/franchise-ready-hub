import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const ConversationMessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    text: { type: String, required: true },
    intent: { type: String },
    scoringSignal: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ConversationSchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', index: true, required: true },
    phone: { type: String, index: true, required: true },
    messages: { type: [ConversationMessageSchema], default: [] },
  },
  { timestamps: true },
);

ConversationSchema.methods.appendMessage = async function appendMessage(message: {
  role: 'user' | 'assistant' | 'system';
  text: string;
  intent?: string;
  scoringSignal?: string;
}): Promise<void> {
  const next = [...(this.messages ?? []), { ...message, createdAt: new Date() }];
  this.messages = next.slice(-40);
  await this.save();
};

export type ConversationDocument = InferSchemaType<typeof ConversationSchema> & {
  _id: mongoose.Types.ObjectId;
  appendMessage: (message: {
    role: 'user' | 'assistant' | 'system';
    text: string;
    intent?: string;
    scoringSignal?: string;
  }) => Promise<void>;
};

export const Conversation: Model<ConversationDocument> =
  mongoose.models.Conversation ??
  mongoose.model<ConversationDocument>('Conversation', ConversationSchema);

