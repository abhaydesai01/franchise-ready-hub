import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const CrmSettingsSchema = new Schema(
  {
    /** Single-doc settings for the CRM bot (singleton). */
    calendlyLink: { type: String, default: '' },
    companyName: { type: String, default: 'Franchise Ready' },
  },
  { timestamps: true, collection: 'crm_settings' },
);

export type CrmSettingsDocument = InferSchemaType<typeof CrmSettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CrmSettings: Model<CrmSettingsDocument> =
  mongoose.models.CrmSettings ??
  mongoose.model<CrmSettingsDocument>('CrmSettings', CrmSettingsSchema);

export async function getCrmSettings(): Promise<{ calendlyLink: string; companyName: string }> {
  let doc = await CrmSettings.findOne().lean();
  if (!doc) {
    await CrmSettings.create({
      calendlyLink: process.env.CALENDLY_LINK ?? '',
      companyName: process.env.COMPANY_NAME ?? 'Franchise Ready',
    });
    doc = await CrmSettings.findOne().lean();
  }
  return {
    calendlyLink: doc?.calendlyLink ?? process.env.CALENDLY_LINK ?? '',
    companyName: doc?.companyName ?? process.env.COMPANY_NAME ?? 'Franchise Ready',
  };
}
