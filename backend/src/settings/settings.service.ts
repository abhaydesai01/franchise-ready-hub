import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  AppSettings,
  AvailabilitySettings,
  SettingsDocument,
} from './schemas/settings.schema';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { selfTestCalendlySigningKey } from '../calendly/calendly-signature';
import type { UpdateAvailabilityDto } from './dto/update-availability.dto';

const DEFAULT_AVAILABILITY = {
  slotDurationMinutes: 30,
  bufferBetweenSlots: 0,
  workingHours: {
    monday: { start: '09:00', end: '18:00', enabled: true },
    tuesday: { start: '09:00', end: '18:00', enabled: true },
    wednesday: { start: '09:00', end: '18:00', enabled: true },
    thursday: { start: '09:00', end: '18:00', enabled: true },
    friday: { start: '09:00', end: '18:00', enabled: true },
    saturday: { start: '10:00', end: '14:00', enabled: true },
    sunday: { start: '09:00', end: '18:00', enabled: false },
  },
  timezone: 'Asia/Kolkata',
  advanceBookingDays: 30,
  slotsToOfferInBot: 3,
  meetingTitle: 'Franchise Discovery Call',
  ghlBookingLink: '',
};

const DEFAULT_SETTINGS = {
  branding: {
    companyName: '',
    logoUrl: '',
    supportEmail: '',
    supportPhone: '',
    website: '',
    addressLine: '',
  },
  thresholds: { notReadyBelow: 40, franchiseReadyMin: 40, franchiseReadyMax: 100 },
  alertRules: {
    coldLeadDaysWarning: 5,
    coldLeadDaysCritical: 8,
    stuckStageDaysWarning: 7,
    stuckStageDaysCritical: 12,
    proposalNotOpenedDaysInfo: 2,
    proposalNotOpenedDaysWarning: 5,
  },
  integrations: [
    { id: 'i1', name: 'WhatsApp (Meta Cloud API)', icon: 'MessageCircle', connected: true, apiKey: '' },
    { id: 'i2', name: 'Cal.com', icon: 'Calendar', connected: false, apiKey: '' },
    { id: 'i3', name: 'Resend (Email)', icon: 'Mail', connected: false, apiKey: '' },
    { id: 'i4', name: 'Claude API (Anthropic)', icon: 'Zap', connected: false, apiKey: '' },
    { id: 'i5', name: 'Meta Ads (Webhook)', icon: 'Globe', connected: false, apiKey: '' },
  ],
  waTemplates: [
    { id: 'wt1', name: 'Gap Nurture Intro', body: 'Hi {lead_name}! This is {consultant_name} from Franchise Ready.', channel: 'WhatsApp' },
    { id: 'wt2', name: 'Discovery Booking CTA', body: 'Hi {lead_name}, your score is {score}/100. Book your discovery call.', channel: 'WhatsApp' },
  ],
  emailTemplates: [
    { id: 'et1', name: 'Welcome Email', subject: 'Welcome, {lead_name}', body: '<h2>Welcome!</h2>', isHtml: true, channel: 'Email' },
    { id: 'et2', name: 'Proposal Email', subject: 'Your proposal — {lead_name}', body: '<h2>Your proposal</h2>', isHtml: true, channel: 'Email' },
  ],
  calendlyLink: '',
  calendlyWebhookSigningKey: '',
  availabilitySettings: DEFAULT_AVAILABILITY,
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(AppSettings.name)
    private readonly settingsModel: Model<SettingsDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private async ensureSettings() {
    const exists = await this.settingsModel.findOne().lean().exec();
    if (!exists) {
      await this.settingsModel.create(DEFAULT_SETTINGS);
      return;
    }

    const $set: Record<string, unknown> = {};
    if (!(exists as any).branding) $set.branding = DEFAULT_SETTINGS.branding;
    if (!(exists as any).thresholds) $set.thresholds = DEFAULT_SETTINGS.thresholds;
    if (!(exists as any).alertRules) $set.alertRules = DEFAULT_SETTINGS.alertRules;
    if (!(exists as any).integrations) $set.integrations = DEFAULT_SETTINGS.integrations;
    if (!(exists as any).waTemplates) $set.waTemplates = DEFAULT_SETTINGS.waTemplates;
    if (!(exists as any).emailTemplates) $set.emailTemplates = DEFAULT_SETTINGS.emailTemplates;
    if ((exists as any).calendlyLink === undefined)
      $set.calendlyLink = DEFAULT_SETTINGS.calendlyLink;
    if ((exists as any).calendlyWebhookSigningKey === undefined)
      $set.calendlyWebhookSigningKey = DEFAULT_SETTINGS.calendlyWebhookSigningKey;
    if (!(exists as any).availabilitySettings) {
      $set.availabilitySettings = DEFAULT_AVAILABILITY;
    }
    if (Object.keys($set).length) {
      await this.settingsModel.updateOne({ _id: (exists as any)._id }, { $set }).exec();
    }
  }

  async getSettings() {
    await this.ensureSettings();
    const settings = await this.settingsModel.findOne().lean<(AppSettings & { _id: string }) | null>().exec();
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto) {
    await this.ensureSettings();
    const $set: Record<string, unknown> = {};
    if (dto.calendlyLink !== undefined) $set.calendlyLink = dto.calendlyLink;
    if (dto.calendlyWebhookSigningKey !== undefined) {
      $set.calendlyWebhookSigningKey = dto.calendlyWebhookSigningKey;
    }
    if (dto.branding) $set.branding = dto.branding;
    if (dto.thresholds) $set.thresholds = dto.thresholds;
    if (dto.alertRules) $set.alertRules = dto.alertRules;
    if (dto.integrations) $set.integrations = dto.integrations;
    if (dto.waTemplates) $set.waTemplates = dto.waTemplates;
    if (dto.emailTemplates) $set.emailTemplates = dto.emailTemplates;

    const updated = await this.settingsModel
      .findOneAndUpdate({}, { $set }, { returnDocument: 'after' })
      .lean<(AppSettings & { _id: string }) | null>()
      .exec();

    if (dto.calendlyLink !== undefined && this.connection.db) {
      await this.connection.db.collection('crm_settings').updateOne(
        {},
        { $set: { calendlyLink: dto.calendlyLink, updatedAt: new Date() } },
        { upsert: true },
      );
    }

    return updated;
  }

  async testCalendlyWebhook(signingKey?: string) {
    await this.ensureSettings();
    const doc = await this.settingsModel.findOne().lean().exec();
    const key =
      signingKey?.trim() ||
      (doc as AppSettings | null)?.calendlyWebhookSigningKey?.trim() ||
      '';
    const valid = selfTestCalendlySigningKey(key);
    return {
      ok: true as const,
      valid,
      message: valid
        ? 'Signing key works with Calendly HMAC verification (self-test).'
        : 'Enter a signing key (at least 8 characters) from Calendly → Integrations → Webhooks.',
    };
  }

  async updateIntegration(
    id: string,
    dto: { apiKey?: string; connected?: boolean },
  ) {
    await this.ensureSettings();
    const doc = await this.settingsModel.findOne().exec();
    if (!doc) return null;
    const integrations = [...doc.integrations];
    const idx = integrations.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    integrations[idx] = {
      ...integrations[idx],
      ...(dto.apiKey !== undefined ? { apiKey: dto.apiKey } : {}),
      ...(dto.connected !== undefined ? { connected: dto.connected } : {}),
    } as any;
    doc.integrations = integrations as any;
    await doc.save();
    return doc.toObject();
  }

  async patchAvailability(dto: UpdateAvailabilityDto) {
    await this.ensureSettings();
    const doc = await this.settingsModel.findOne().exec();
    if (!doc) return null;
    const curRaw = (doc.toObject() as unknown as {
      availabilitySettings?: AvailabilitySettings;
    }).availabilitySettings;
    const cur = curRaw
      ? (JSON.parse(JSON.stringify(curRaw)) as Record<string, unknown>)
      : { ...DEFAULT_AVAILABILITY };
    const merged: Record<string, unknown> = { ...cur, ...dto };
    if (dto.workingHours) {
      merged.workingHours = {
        ...(cur.workingHours as object),
        ...dto.workingHours,
      };
    }
    if (dto.primaryConsultantUserId !== undefined) {
      const p = dto.primaryConsultantUserId.trim();
      merged.primaryConsultantUserId = p
        ? new Types.ObjectId(p)
        : undefined;
    }
    doc.set('availabilitySettings', merged);
    await doc.save();
    return doc.toObject();
  }

  async testIntegration(id: string) {
    await this.ensureSettings();
    const doc = await this.settingsModel.findOne().exec();
    if (!doc) return { ok: false, connected: false };
    const integration = doc.integrations.find((i) => i.id === id);
    if (!integration) return { ok: false, connected: false };
    const connected = String(integration.apiKey ?? '').trim().length > 0;
    integration.connected = connected;
    await doc.save();
    return { ok: true, connected };
  }
}
