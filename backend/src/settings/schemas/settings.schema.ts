import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type SettingsDocument = HydratedDocument<AppSettings>;

@Schema({ _id: false })
export class Thresholds {
  @Prop({ required: true, default: 40 })
  notReadyBelow!: number;

  @Prop({ required: true, default: 40 })
  franchiseReadyMin!: number;

  @Prop({ required: true, default: 100 })
  franchiseReadyMax!: number;
}

@Schema({ _id: false })
export class AlertRules {
  @Prop({ required: true, default: 5 })
  coldLeadDaysWarning!: number;

  @Prop({ required: true, default: 8 })
  coldLeadDaysCritical!: number;

  @Prop({ required: true, default: 7 })
  stuckStageDaysWarning!: number;

  @Prop({ required: true, default: 12 })
  stuckStageDaysCritical!: number;

  @Prop({ required: true, default: 2 })
  proposalNotOpenedDaysInfo!: number;

  @Prop({ required: true, default: 5 })
  proposalNotOpenedDaysWarning!: number;
}

@Schema({ _id: false })
export class IntegrationSetting {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  icon!: string;

  @Prop({ required: true, default: false })
  connected!: boolean;

  /** Optional until the user saves a key in Settings (empty string is valid). */
  @Prop({ type: String, required: false, default: '' })
  apiKey!: string;
}

@Schema({ _id: false })
export class WATemplateSetting {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ required: true, default: 'WhatsApp' })
  channel!: 'WhatsApp';
}

@Schema({ _id: false })
export class EmailTemplateSetting {
  @Prop({ required: true })
  id!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  subject!: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ required: true, default: true })
  isHtml!: boolean;

  @Prop({ required: true, default: 'Email' })
  channel!: 'Email';
}

const ThresholdsSchema = SchemaFactory.createForClass(Thresholds);
const AlertRulesSchema = SchemaFactory.createForClass(AlertRules);
const IntegrationSettingSchema = SchemaFactory.createForClass(IntegrationSetting);
const WATemplateSettingSchema = SchemaFactory.createForClass(WATemplateSetting);
const EmailTemplateSettingSchema = SchemaFactory.createForClass(EmailTemplateSetting);

/** Branding + contact for PDFs, emails, footers */
@Schema({ _id: false })
export class BrandingContact {
  @Prop({ default: '' })
  companyName!: string;

  @Prop({ default: '' })
  logoUrl!: string;

  @Prop({ default: '' })
  supportEmail!: string;

  @Prop({ default: '' })
  supportPhone!: string;

  @Prop({ default: '' })
  website!: string;

  @Prop({ default: '' })
  addressLine!: string;
}

const BrandingContactSchema = SchemaFactory.createForClass(BrandingContact);

@Schema({ _id: false })
export class DayHoursConfig {
  @Prop({ default: '09:00' })
  start!: string;

  @Prop({ default: '18:00' })
  end!: string;

  @Prop({ default: true })
  enabled!: boolean;
}

const DayHoursConfigSchema = SchemaFactory.createForClass(DayHoursConfig);

@Schema({ _id: false })
export class WorkingHoursConfig {
  @Prop({ type: DayHoursConfigSchema, default: () => ({ start: '09:00', end: '18:00', enabled: true }) })
  monday!: DayHoursConfig;

  @Prop({ type: DayHoursConfigSchema, default: () => ({ start: '09:00', end: '18:00', enabled: true }) })
  tuesday!: DayHoursConfig;

  @Prop({ type: DayHoursConfigSchema, default: () => ({ start: '09:00', end: '18:00', enabled: true }) })
  wednesday!: DayHoursConfig;

  @Prop({ type: DayHoursConfigSchema, default: () => ({ start: '09:00', end: '18:00', enabled: true }) })
  thursday!: DayHoursConfig;

  @Prop({ type: DayHoursConfigSchema, default: () => ({ start: '09:00', end: '18:00', enabled: true }) })
  friday!: DayHoursConfig;

  @Prop({ type: DayHoursConfigSchema, default: () => ({ start: '10:00', end: '14:00', enabled: false }) })
  saturday!: DayHoursConfig;

  @Prop({ type: DayHoursConfigSchema, default: () => ({ start: '09:00', end: '18:00', enabled: false }) })
  sunday!: DayHoursConfig;
}

const WorkingHoursConfigSchema = SchemaFactory.createForClass(WorkingHoursConfig);

@Schema({ _id: false })
export class AvailabilitySettings {
  @Prop({ default: 30 })
  slotDurationMinutes!: number;

  @Prop({ default: 0 })
  bufferBetweenSlots!: number;

  @Prop({ type: WorkingHoursConfigSchema, required: true, default: () => ({}) })
  workingHours!: WorkingHoursConfig;

  @Prop({ default: 'Asia/Kolkata' })
  timezone!: string;

  @Prop({ default: 30 })
  advanceBookingDays!: number;

  @Prop({ default: 3 })
  slotsToOfferInBot!: number;

  @Prop({ default: 'Franchise Discovery Call' })
  meetingTitle!: string;

  /** Fallback browser booking (GHL / legacy). */
  @Prop({ default: '' })
  ghlBookingLink!: string;

  @Prop({ type: Types.ObjectId, ref: User.name })
  primaryConsultantUserId?: Types.ObjectId;
}

const AvailabilitySettingsSchema = SchemaFactory.createForClass(AvailabilitySettings);

@Schema({ collection: 'app_settings', timestamps: true })
export class AppSettings {
  @Prop({ type: BrandingContactSchema, required: true, default: {} })
  branding!: BrandingContact;

  /** Shareable Calendly booking URL (synced to `crm_settings` for WhatsApp bot). */
  @Prop({ default: '' })
  calendlyLink!: string;

  /** Webhook signing key from Calendly (Integrations → Webhooks). */
  @Prop({ default: '' })
  calendlyWebhookSigningKey!: string;

  @Prop({ type: ThresholdsSchema, required: true, default: {} })
  thresholds!: Thresholds;

  @Prop({ type: AlertRulesSchema, required: true, default: {} })
  alertRules!: AlertRules;

  @Prop({ type: [IntegrationSettingSchema], default: [] })
  integrations!: IntegrationSetting[];

  @Prop({ type: [WATemplateSettingSchema], default: [] })
  waTemplates!: WATemplateSetting[];

  @Prop({ type: [EmailTemplateSettingSchema], default: [] })
  emailTemplates!: EmailTemplateSetting[];

  /** Delay before WhatsApp no-response triggers voice fallback (synced to `crm_settings`). */
  @Prop({ default: 30 })
  voiceFallbackDelayMinutes!: number;

  /** Max outbound voice attempts before nurture. */
  @Prop({ default: 2 })
  maxVoiceAttempts!: number;

  /** Vaani agent UUID when not using env only. */
  @Prop({ default: '' })
  vaaniAgentId!: string;

  @Prop({ default: '' })
  vaaniOutboundNumber!: string;

  @Prop({ type: AvailabilitySettingsSchema, default: () => ({}) })
  availabilitySettings!: AvailabilitySettings;
}

export const AppSettingsSchema = SchemaFactory.createForClass(AppSettings);
