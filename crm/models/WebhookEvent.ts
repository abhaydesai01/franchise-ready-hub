import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const WebhookEventSchema = new Schema(
  {
    source: { type: String, required: true, index: true }, // meta | whatsapp
    eventKey: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['received', 'processing', 'processed', 'failed'],
      default: 'received',
      index: true,
    },
    payload: { type: Schema.Types.Mixed, required: true },
    error: { type: String },
    attempts: { type: Number, default: 0 },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

export type WebhookEventDocument = InferSchemaType<typeof WebhookEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WebhookEvent: Model<WebhookEventDocument> =
  mongoose.models.WebhookEvent ??
  mongoose.model<WebhookEventDocument>('WebhookEvent', WebhookEventSchema);
