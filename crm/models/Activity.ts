import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/** CRM activity log for WhatsApp bot (and future channels). */
const ActivitySchema = new Schema(
  {
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    activityType: { type: String, enum: ['whatsapp'], required: true, default: 'whatsapp' },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    body: { type: String, required: true },
    botState: { type: String },
    waMessageId: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'activities' },
);

ActivitySchema.index({ leadId: 1, createdAt: -1 });

export type ActivityDocument = InferSchemaType<typeof ActivitySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Activity: Model<ActivityDocument> =
  mongoose.models.Activity ?? mongoose.model<ActivityDocument>('Activity', ActivitySchema);
