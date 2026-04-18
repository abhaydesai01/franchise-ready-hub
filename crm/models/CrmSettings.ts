import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const CrmSettingsSchema = new Schema(
  {
    /** Single-doc settings for the CRM bot (singleton). */
    calendlyLink: { type: String, default: '' },
    companyName: { type: String, default: 'Franchise Ready' },
    /** Synced from Nest app_settings — delay before voice fallback job. */
    voiceFallbackDelayMinutes: { type: Number, default: 30 },
    maxVoiceAttempts: { type: Number, default: 2 },
  },
  { timestamps: true, collection: 'crm_settings' },
);

export type CrmSettingsDocument = InferSchemaType<typeof CrmSettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CrmSettings: Model<CrmSettingsDocument> =
  mongoose.models.CrmSettings ??
  mongoose.model<CrmSettingsDocument>('CrmSettings', CrmSettingsSchema);

export async function getCrmSettings(): Promise<{
  calendlyLink: string;
  companyName: string;
  voiceFallbackDelayMinutes: number;
  maxVoiceAttempts: number;
}> {
  let doc = await CrmSettings.findOne().lean();
  if (!doc) {
    await CrmSettings.create({
      calendlyLink: process.env.CALENDLY_LINK ?? '',
      companyName: process.env.COMPANY_NAME ?? 'Franchise Ready',
      voiceFallbackDelayMinutes: 30,
      maxVoiceAttempts: 2,
    });
    doc = await CrmSettings.findOne().lean();
  }
  return {
    calendlyLink: doc?.calendlyLink ?? process.env.CALENDLY_LINK ?? '',
    companyName: doc?.companyName ?? process.env.COMPANY_NAME ?? 'Franchise Ready',
    voiceFallbackDelayMinutes: (() => {
      if (doc?.voiceFallbackDelayMinutes != null && doc.voiceFallbackDelayMinutes > 0) {
        return doc.voiceFallbackDelayMinutes;
      }
      const fromEnv = Number(process.env.VOICE_FALLBACK_DELAY_MINUTES);
      return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 30;
    })(),
    maxVoiceAttempts: doc?.maxVoiceAttempts ?? 2,
  };
}
