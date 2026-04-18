import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Mirrors CRM `crm_settings` singleton (Calendly link for email CTA). */
export type CrmSettingsDocument = HydratedDocument<CrmSettings>;

@Schema({ collection: 'crm_settings', timestamps: true })
export class CrmSettings {
  @Prop({ default: '' })
  calendlyLink!: string;

  @Prop({ default: '' })
  companyName!: string;
}

export const CrmSettingsSchema = SchemaFactory.createForClass(CrmSettings);
