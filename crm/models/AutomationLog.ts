import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const AutomationLogSchema = new Schema(
  {
    /** Set when known; Meta/WA may receive messages before a Lead row exists. */
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: false, index: true },
    sequenceName: { type: String },
    stepNumber: { type: String },
    stepName: { type: String },
    channel: {
      type: String,
      enum: ['whatsapp', 'email', 'voice'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      default: 'outbound',
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'received'],
      default: 'pending',
    },
    waMessageId: { type: String },
    templateName: { type: String },
    content: { type: String },
    errorDetails: { type: String },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    jobId: { type: String },
  },
  { timestamps: true },
);

AutomationLogSchema.index({ leadId: 1, createdAt: -1 });
AutomationLogSchema.index({ waMessageId: 1 });
AutomationLogSchema.index({ status: 1, channel: 1 });

export type AutomationLogDocument = InferSchemaType<typeof AutomationLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AutomationLog: Model<AutomationLogDocument> =
  mongoose.models.AutomationLog ??
  mongoose.model<AutomationLogDocument>('AutomationLog', AutomationLogSchema);
