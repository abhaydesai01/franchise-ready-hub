import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { OAuth2Client } from 'google-auth-library';
import { createHmac, timingSafeEqual } from 'crypto';
import { Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { createEvent } from 'ics';
import { Resend } from 'resend';
import { CalendarIntegration, CalendarIntegrationDocument } from './calendar-integration.schema';
import { CalendarTokenCryptoService } from './calendar-token-crypto.service';
import {
  googleCreateMeetEvent,
  googleDeleteEvent,
  googleFreeBusy,
  googleListEvents,
  googlePatchEvent,
} from './calendar-google.api';
import {
  outlookCreateEvent,
  outlookDeleteEvent,
  outlookPatchEvent,
} from './calendar-outlook.api';
import {
  formatSlotLabels,
  istWallToDate,
  kolkataWeekdayKey,
  kolkataYmd,
  overlaps,
} from './calendar-slot.util';
import { SlotUnavailableException } from './calendar.exceptions';
import { SettingsService } from '../settings/settings.service';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivitiesService } from '../activities/activities.service';
import { WhatsappCloudService } from '../whatsapp/whatsapp-cloud.service';
import { getSingletonBullConnection } from '../queues/redis-connection';
import type { AppSettings } from '../settings/schemas/settings.schema';

const CACHE_TTL_SEC = 180;
const VOICE_SLOT_TTL_SEC = 600;

export type BookSlotInput = {
  leadId: string;
  slotStartTime: Date;
  slotEndTime: Date;
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  bookedVia: 'crm_bot' | 'crm_voice' | 'ghl_link' | 'crm_voice_ad_hoc';
  /**
   * Ad-hoc times from a voice call: skip the precomputed available-slot match;
   * block only on Google free/busy for the consultant. Body copy from voice summary + scorecard.
   */
  adHocFromVoice?: {
    eventDescription: string;
    leadBodyHtml: string;
    consultantBodyHtml: string;
  };
};

@Injectable()
export class CalendarService {
  private readonly log = new Logger(CalendarService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CalendarTokenCryptoService,
    @InjectModel(CalendarIntegration.name)
    private readonly integrationModel: Model<CalendarIntegrationDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly activities: ActivitiesService,
    private readonly whatsapp: WhatsappCloudService,
  ) {}

  private apiBase(): string {
    return (this.config.get<string>('publicBaseUrl') ?? '').replace(/\/$/, '');
  }

  private frontendBase(): string {
    return (this.config.get<string>('frontendUrl') ?? '').replace(/\/$/, '');
  }

  private signState(userId: string, provider: 'google' | 'outlook'): string {
    const secret = this.config.get<string>('jwt.accessSecret') ?? 'state';
    const ts = Date.now();
    const payload = `${userId}|${provider}|${ts}`;
    const sig = createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}::${sig}`).toString('base64url');
  }

  verifyState(state: string, provider: 'google' | 'outlook'): string {
    const secret = this.config.get<string>('jwt.accessSecret') ?? 'state';
    const raw = Buffer.from(state, 'base64url').toString('utf8');
    const [payload, sig] = raw.split('::');
    if (!payload || !sig) throw new BadRequestException('Invalid state');
    const parts = payload.split('|');
    const userId = parts[0];
    const p = parts[1];
    const ts = Number(parts[2]);
    if (p !== provider) throw new BadRequestException('Invalid state');
    const expect = createHmac('sha256', secret).update(payload).digest('hex');
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) {
      throw new BadRequestException('Invalid state');
    }
    if (Date.now() - ts > 20 * 60 * 1000) {
      throw new BadRequestException('State expired');
    }
    return userId;
  }

  buildGoogleAuthUrl(userId: string): string {
    const clientId = this.config.get<string>('googleClientId') ?? '';
    const redirectUri = `${this.apiBase()}/api/v1/calendar/google/callback`;
    const state = this.signState(userId, 'google');
    const scope = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' ');
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', scope);
    u.searchParams.set('access_type', 'offline');
    u.searchParams.set('prompt', 'consent');
    u.searchParams.set('state', state);
    return u.toString();
  }

  buildOutlookAuthUrl(userId: string): string {
    const clientId = this.config.get<string>('azureClientId') ?? '';
    const redirectUri = `${this.apiBase()}/api/v1/calendar/outlook/callback`;
    const scope = ['Calendars.ReadWrite', 'offline_access', 'User.Read'].join(
      ' ',
    );
    const state = this.signState(userId, 'outlook');
    const u = new URL(
      `https://login.microsoftonline.com/${this.config.get('azureTenantId') ?? 'common'}/oauth2/v2.0/authorize`,
    );
    u.searchParams.set('client_id', clientId);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('scope', scope);
    u.searchParams.set('state', state);
    return u.toString();
  }

  async handleGoogleCallback(code: string, state: string): Promise<string> {
    const userId = this.verifyState(state, 'google');
    const redirectUri = `${this.apiBase()}/api/v1/calendar/google/callback`;
    const oauth2 = new OAuth2Client(
      this.config.get('googleClientId'),
      this.config.get('googleClientSecret'),
      redirectUri,
    );
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.access_token) throw new BadRequestException('No access token');
    oauth2.setCredentials(tokens);
    const { google } = await import('googleapis');
    const oauth2v2 = google.oauth2({ version: 'v2', auth: oauth2 });
    const ui = await oauth2v2.userinfo.get();
    const email = String(ui.data.email ?? '');

    const exp = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600_000);

    await this.integrationModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          googleAccessTokenEnc: this.crypto.encrypt(tokens.access_token),
          googleRefreshTokenEnc: this.crypto.encryptOptional(
            tokens.refresh_token ?? '',
          ),
          googleTokenExpiry: exp,
          googleEmail: email,
          isGoogleConnected: true,
          lastGoogleSyncAt: new Date(),
        },
      },
      { upsert: true },
    );

    const fe =
      this.frontendBase() || (this.config.get('crmPublicUrl') ?? '');
    return `${fe}/settings?tab=calendar&google=connected`;
  }

  async handleOutlookCallback(code: string, state: string): Promise<string> {
    const userId = this.verifyState(state, 'outlook');
    const redirectUri = `${this.apiBase()}/api/v1/calendar/outlook/callback`;
    const tenant = this.config.get<string>('azureTenantId') ?? 'common';
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.get<string>('azureClientId') ?? '',
      client_secret: this.config.get<string>('azureClientSecret') ?? '',
      code,
      redirect_uri: redirectUri,
    });
    const tokRes = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    const tokJson = (await tokRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!tokRes.ok || !tokJson.access_token) {
      throw new BadRequestException(tokJson.error ?? 'Outlook token failed');
    }
    const exp = new Date(
      Date.now() + (tokJson.expires_in ?? 3600) * 1000 - 60_000,
    );
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokJson.access_token}` },
    });
    const me = (await meRes.json()) as { mail?: string; userPrincipalName?: string };
    const email = String(me.mail ?? me.userPrincipalName ?? '');

    await this.integrationModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          outlookAccessTokenEnc: this.crypto.encrypt(tokJson.access_token),
          outlookRefreshTokenEnc: this.crypto.encryptOptional(
            tokJson.refresh_token ?? '',
          ),
          outlookTokenExpiry: exp,
          outlookEmail: email,
          isOutlookConnected: true,
        },
      },
      { upsert: true },
    );

    const fe =
      this.frontendBase() || (this.config.get('crmPublicUrl') ?? '');
    return `${fe}/settings?tab=calendar&outlook=connected`;
  }

  async disconnectGoogle(userId: string): Promise<{ ok: boolean }> {
    const doc = await this.integrationModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (!doc?.isGoogleConnected) return { ok: true };
    const token = this.crypto.decryptOptional(doc.googleAccessTokenEnc);
    if (token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: 'POST',
      }).catch(() => {});
    }
    await this.integrationModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          isGoogleConnected: false,
          googleAccessTokenEnc: '',
          googleRefreshTokenEnc: '',
          googleEmail: '',
        },
      },
    );
    return { ok: true };
  }

  async disconnectOutlook(userId: string): Promise<{ ok: boolean }> {
    await this.integrationModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      {
        $set: {
          isOutlookConnected: false,
          outlookAccessTokenEnc: '',
          outlookRefreshTokenEnc: '',
          outlookEmail: '',
        },
      },
    );
    return { ok: true };
  }

  private async getPrimaryIntegration(): Promise<
    CalendarIntegration & { _id: string }
  > {
    const app = await this.settings.getSettings();
    const pid = (app as AppSettings & { availabilitySettings?: { primaryConsultantUserId?: Types.ObjectId } })
      ?.availabilitySettings?.primaryConsultantUserId;
    let doc: (CalendarIntegration & { _id: string }) | null = null;
    if (pid) {
      doc = await this.integrationModel
        .findOne({
          userId: new Types.ObjectId(pid),
          isGoogleConnected: true,
        })
        .lean<CalendarIntegration & { _id: string }>()
        .exec();
    }
    if (!doc) {
      doc = await this.integrationModel
        .findOne({ isGoogleConnected: true })
        .sort({ updatedAt: -1 })
        .lean<CalendarIntegration & { _id: string }>()
        .exec();
    }
    if (!doc?.isGoogleConnected) {
      throw new BadRequestException(
        'Google Calendar is not connected. Ask an admin to connect in Settings.',
      );
    }
    return doc;
  }

  private async getGoogleOAuth2ForUser(
    userId: string,
  ): Promise<OAuth2Client> {
    const doc = await this.integrationModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doc?.isGoogleConnected) {
      throw new BadRequestException('Google not connected');
    }
    const redirectUri = `${this.apiBase()}/api/v1/calendar/google/callback`;
    const oauth2 = new OAuth2Client(
      this.config.get('googleClientId'),
      this.config.get('googleClientSecret'),
      redirectUri,
    );
    let access = this.crypto.decryptOptional(doc.googleAccessTokenEnc);
    const refresh = this.crypto.decryptOptional(doc.googleRefreshTokenEnc);
    const exp = doc.googleTokenExpiry?.getTime() ?? 0;
    if (!access || (exp < Date.now() + 5 * 60 * 1000 && refresh)) {
      try {
        oauth2.setCredentials({ refresh_token: refresh });
        const { credentials } = await oauth2.refreshAccessToken();
        access = credentials.access_token ?? access;
        const newExp = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : new Date(Date.now() + 3600_000);
        await this.integrationModel.updateOne(
          { _id: doc._id },
          {
            $set: {
              googleAccessTokenEnc: this.crypto.encrypt(access ?? ''),
              googleTokenExpiry: newExp,
            },
          },
        );
      } catch (e) {
        this.log.error('Google refresh failed', e);
        await this.integrationModel.updateOne(
          { _id: doc._id },
          { $set: { isGoogleConnected: false } },
        );
        await this.notifications.notifyAdminsAndManagers({
          type: 'google_calendar_auth',
          description:
            'Google Calendar disconnected — please reconnect in Settings.',
        });
        throw new BadRequestException('Google Calendar session expired');
      }
    }
    oauth2.setCredentials({ access_token: access, refresh_token: refresh });
    return oauth2;
  }

  private async getOutlookAccessToken(userId: string): Promise<string> {
    const doc = await this.integrationModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!doc?.isOutlookConnected) return '';
    let access = this.crypto.decryptOptional(doc.outlookAccessTokenEnc);
    const refresh = this.crypto.decryptOptional(doc.outlookRefreshTokenEnc);
    const exp = doc.outlookTokenExpiry?.getTime() ?? 0;
    if (!access || exp < Date.now() + 5 * 60 * 1000) {
      if (!refresh) return '';
      const tenant = this.config.get<string>('azureTenantId') ?? 'common';
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.get<string>('azureClientId') ?? '',
        client_secret: this.config.get<string>('azureClientSecret') ?? '',
        refresh_token: refresh,
      });
      const tokRes = await fetch(
        `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
      );
      const tokJson = (await tokRes.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (!tokJson.access_token) return '';
      access = tokJson.access_token;
      const newExp = new Date(
        Date.now() + (tokJson.expires_in ?? 3600) * 1000 - 60_000,
      );
      await this.integrationModel.updateOne(
        { _id: doc._id },
        {
          $set: {
            outlookAccessTokenEnc: this.crypto.encrypt(access),
            outlookTokenExpiry: newExp,
          },
        },
      );
    }
    return access ?? '';
  }

  private cacheKey(settingsHash: string): string {
    return `cal:slots:${settingsHash}`;
  }

  async getAvailableSlots(
    requestedBy: 'bot' | 'voice',
    count: number,
    settingsHash?: string,
  ): Promise<
    Array<{
      index: number;
      startTime: string;
      endTime: string;
      label: string;
      labelShort: string;
    }>
  > {
    const app = await this.settings.getSettings();
    const av = app?.availabilitySettings;
    if (!av) throw new BadRequestException('Availability settings missing');

    const integration = await this.getPrimaryIntegration();
    const uid = String(integration.userId);
    const oauth2 = await this.getGoogleOAuth2ForUser(uid);
    const tz = av.timezone ?? 'Asia/Kolkata';
    const slotMin = av.slotDurationMinutes ?? 30;
    const buf = av.bufferBetweenSlots ?? 15;
    const advDays = av.advanceBookingDays ?? 7;

    const windowStart = new Date(Date.now() + 2 * 3600 * 1000);
    const windowEnd = new Date(
      windowStart.getTime() + advDays * 24 * 3600 * 1000,
    );

    const hash =
      settingsHash ??
      `${uid}:${slotMin}:${buf}:${advDays}:${windowStart.toISOString().slice(0, 10)}`;

    let redis: import('ioredis').default | null = null;
    try {
      redis = getSingletonBullConnection();
    } catch {
      this.log.warn('Redis unavailable – slot caching disabled');
    }
    const ck = this.cacheKey(hash);
    if (redis) {
      const cached = await redis.get(ck).catch(() => null);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Array<{
            start: string;
            end: string;
          }>;
          return this.formatSlotArray(parsed.slice(0, count), tz);
        } catch {
          // fall through
        }
      }
    }

    const wh = av.workingHours as unknown as Record<
      string,
      { start: string; end: string; enabled: boolean }
    >;
    const candidates: { start: Date; end: Date }[] = [];
    for (let i = 0; i < advDays; i++) {
      const dayProbe = new Date(windowStart.getTime() + i * 86400000);
      const { y, m, d } = kolkataYmd(dayProbe);
      const wk = kolkataWeekdayKey(dayProbe);
      const dayConf = wh[wk];
      if (!dayConf?.enabled) continue;
      const [sh, sm] = dayConf.start.split(':').map((x) => parseInt(x, 10));
      const [eh, em] = dayConf.end.split(':').map((x) => parseInt(x, 10));
      let cursor = istWallToDate(y, m, d, sh, sm);
      const dayEnd = istWallToDate(y, m, d, eh, em);
      const durMs = slotMin * 60 * 1000;
      const bufferMs = buf * 60 * 1000;
      while (cursor.getTime() + durMs <= dayEnd.getTime()) {
        if (cursor.getTime() >= windowStart.getTime()) {
          candidates.push({
            start: new Date(cursor),
            end: new Date(cursor.getTime() + durMs),
          });
        }
        cursor = new Date(cursor.getTime() + durMs + bufferMs);
      }
    }

    const busy = await googleFreeBusy(oauth2, {
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      calendarId: integration.googleCalendarId || 'primary',
    });

    const busyRanges = busy
      .filter((b) => b.start && b.end)
      .map((b) => ({
        start: new Date(b.start!),
        end: new Date(b.end!),
      }));

    const leads = await this.leadModel
      .find({
        'discoveryCall.status': 'scheduled',
        'discoveryCall.scheduledAt': {
          $gte: windowStart,
          $lte: windowEnd,
        },
      })
      .select('discoveryCall')
      .lean()
      .exec();

    const crmBlocks = leads
      .map((l) => {
        const dc = l.discoveryCall;
        if (!dc?.scheduledAt || !dc.endTime) return null;
        return {
          start: new Date(dc.scheduledAt),
          end: new Date(dc.endTime),
        };
      })
      .filter(Boolean) as { start: Date; end: Date }[];

    const free: { start: Date; end: Date }[] = [];
    outer: for (const c of candidates) {
      for (const b of busyRanges) {
        if (overlaps(c.start, c.end, b.start, b.end)) continue outer;
      }
      for (const b of crmBlocks) {
        if (overlaps(c.start, c.end, b.start, b.end)) continue outer;
      }
      free.push(c);
    }

    const serializable = free.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
    }));
    if (redis) {
      await redis.setex(ck, CACHE_TTL_SEC, JSON.stringify(serializable)).catch(() => {});
    }

    return this.formatSlotArray(serializable.slice(0, count), tz);
  }

  private formatSlotArray(
    slots: Array<{ start: string; end: string }>,
    tz: string,
  ) {
    return slots.map((s, i) => {
      const st = new Date(s.start);
      const en = new Date(s.end);
      const { label, labelShort } = formatSlotLabels(st, tz);
      return {
        index: i + 1,
        startTime: st.toISOString(),
        endTime: en.toISOString(),
        label,
        labelShort,
      };
    });
  }

  private async assertTimeRangeIsFreeOnGoogle(
    oauth2: OAuth2Client,
    calendarId: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('Invalid time range for booking');
    }
    const pad = 60_000;
    const busy = await googleFreeBusy(oauth2, {
      timeMin: new Date(start.getTime() - pad).toISOString(),
      timeMax: new Date(end.getTime() + pad).toISOString(),
      calendarId,
    });
    const ranges = busy
      .filter((b) => b.start && b.end)
      .map((b) => ({
        start: new Date(b.start!),
        end: new Date(b.end!),
      }));
    for (const b of ranges) {
      if (overlaps(start, end, b.start, b.end)) {
        throw new SlotUnavailableException();
      }
    }
  }

  async bookSlot(input: BookSlotInput): Promise<{
    meetLink: string;
    labelFull: string;
    googleEventId?: string;
    outlookEventId?: string;
  }> {
    if (!input.leadEmail?.trim()) {
      throw new BadRequestException('Lead email is required to book');
    }
    const lead = await this.leadModel
      .findById(input.leadId)
      .exec();
    if (!lead) throw new NotFoundException('Lead not found');

    const integration = await this.getPrimaryIntegration();
    const uid = String(integration.userId);
    const oauth2 = await this.getGoogleOAuth2ForUser(uid);
    const gCalId = integration.googleCalendarId || 'primary';

    if (input.adHocFromVoice) {
      await this.assertTimeRangeIsFreeOnGoogle(
        oauth2,
        gCalId,
        input.slotStartTime,
        input.slotEndTime,
      );
    } else {
      const available = await this.getAvailableSlots('bot', 30);
      const startMs = input.slotStartTime.getTime();
      const endMs = input.slotEndTime.getTime();
      const match = available.find(
        (s) =>
          Math.abs(new Date(s.startTime).getTime() - startMs) < 60_000 &&
          Math.abs(new Date(s.endTime).getTime() - endMs) < 60_000,
      );
      if (!match) throw new SlotUnavailableException();
    }

    const consultantUserId = uid;
    const settings = await this.settings.getSettings();
    const av = settings?.availabilitySettings;
    const meetTitle =
      av?.meetingTitle ?? 'Franchise Discovery Call';
    const scorecardPdfUrl = lead.scorecardPdfUrl ?? '';

    const eventDescription = input.adHocFromVoice
      ? `${input.adHocFromVoice.eventDescription}\n\n---\nLead: ${input.leadName}\nEmail: ${input.leadEmail}\nPhone: ${input.leadPhone ?? '—'}`
      : `Discovery call booked via Franchise CRM.\n\nLead: ${input.leadName}\nEmail: ${input.leadEmail}\nPhone: ${input.leadPhone ?? '—'}\n\nScorecard: ${scorecardPdfUrl}`;

    const eventBody = {
      summary: `${meetTitle} — ${input.leadName}`,
      description: eventDescription,
      start: {
        dateTime: input.slotStartTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: input.slotEndTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      attendees: [{ email: input.leadEmail }],
      conferenceData: {
        createRequest: {
          requestId: `${input.leadId}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email' as const, minutes: 1440 },
          { method: 'popup' as const, minutes: 60 },
        ],
      },
    };

    const created = await googleCreateMeetEvent(oauth2, eventBody);
    const meetLink = created.hangoutLink ?? '';
    const googleEventId = created.id ?? '';

    let outlookEventId = '';
    const outAccess = await this.getOutlookAccessToken(consultantUserId);
    if (outAccess) {
      const outlookBody = input.adHocFromVoice
        ? `${input.adHocFromVoice.consultantBodyHtml}<p><a href="${meetLink}">Join Google Meet</a></p><p>Phone: ${escapeHtml(input.leadPhone ?? '—')}</p>`
        : `<p>Discovery call with <strong>${escapeHtml(input.leadName)}</strong></p><p>Email: ${escapeHtml(input.leadEmail)}<br/>Phone: ${escapeHtml(input.leadPhone ?? '—')}</p><p><a href="${meetLink}">Join Google Meet</a></p><p>Scorecard: <a href="${escapeHtml(scorecardPdfUrl)}">View Report</a></p>`;
      try {
        const od = await outlookCreateEvent(outAccess, {
          subject: `${meetTitle} — ${input.leadName}`,
          body: {
            contentType: 'HTML',
            content: outlookBody,
          },
          start: {
            dateTime: input.slotStartTime
              .toISOString()
              .replace(/\.\d{3}Z$/, '')
              .replace('Z', '')
              .slice(0, 19),
            timeZone: 'India Standard Time',
          },
          end: {
            dateTime: input.slotEndTime
              .toISOString()
              .replace(/\.\d{3}Z$/, '')
              .replace('Z', '')
              .slice(0, 19),
            timeZone: 'India Standard Time',
          },
          attendees: [
            {
              emailAddress: {
                address: input.leadEmail,
                name: input.leadName,
              },
              type: 'required',
            },
          ],
          isOnlineMeeting: false,
          location: {
            displayName: 'Google Meet',
            locationUri: meetLink,
          },
        });
        outlookEventId = od.id;
      } catch (e) {
        this.log.warn('Outlook event skipped', e);
      }
    }

    const { labelFull } = formatSlotLabels(
      input.slotStartTime,
      av?.timezone ?? 'Asia/Kolkata',
    );

    const icsBuf = this.buildIcsBuffer({
      title: `${meetTitle} — ${input.leadName}`,
      start: input.slotStartTime,
      end: input.slotEndTime,
      meetLink,
      organizerEmail: integration.googleEmail,
      attendeeEmail: input.leadEmail,
    });

    const jobIds = await this.scheduleReminderJobs(
      input.leadId,
      input.slotStartTime,
    );

    lead.discoveryCall = {
      ...(lead.discoveryCall ?? {}),
      scheduledAt: input.slotStartTime,
      endTime: input.slotEndTime,
      meetingLink: meetLink,
      meetLink,
      status: 'scheduled',
      bookedVia: input.bookedVia,
      googleEventId,
      outlookEventId,
      reminderJobIds: jobIds,
    };
    lead.stage = 'call_booked';
    await lead.save();

    await this.sendBookingNotifications({
      lead,
      meetLink,
      labelFull,
      icsBuf,
      leadEmail: input.leadEmail,
      consultantEmail: integration.googleEmail,
      adHocFromVoice: input.adHocFromVoice
        ? {
            leadBodyHtml: input.adHocFromVoice.leadBodyHtml,
            consultantBodyHtml: input.adHocFromVoice.consultantBodyHtml,
          }
        : undefined,
    });

    await this.activities.createForLead(input.leadId, {
      type: 'call_booked',
      description: `Discovery call booked for ${labelFull}`,
      addedBy: 'Calendar',
    });

    return { meetLink, labelFull, googleEventId, outlookEventId };
  }

  private buildIcsBuffer(params: {
    title: string;
    start: Date;
    end: Date;
    meetLink: string;
    organizerEmail: string;
    attendeeEmail: string;
  }): Buffer {
    const { y, m, d } = kolkataYmd(params.start);
    const sh = parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
      }).format(params.start),
      10,
    );
    const sm = parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        minute: 'numeric',
      }).format(params.start),
      10,
    );
    const eh = parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
      }).format(params.end),
      10,
    );
    const em = parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        minute: 'numeric',
      }).format(params.end),
      10,
    );

    const result = createEvent({
      title: params.title,
      start: [y, m, d, sh, sm],
      startInputType: 'local',
      duration: {
        minutes: Math.round(
          (params.end.getTime() - params.start.getTime()) / 60000,
        ),
      },
      location: params.meetLink,
      description: `Join: ${params.meetLink}`,
      organizer: { name: 'Consultant', email: params.organizerEmail },
      attendees: [{ name: 'Lead', email: params.attendeeEmail }],
    });
    if (result.error || !result.value) {
      return Buffer.from('');
    }
    return Buffer.from(result.value, 'utf8');
  }

  private async scheduleReminderJobs(
    leadId: string,
    scheduledAt: Date,
  ): Promise<string[]> {
    let conn: import('ioredis').default;
    try {
      conn = getSingletonBullConnection();
    } catch {
      this.log.warn('Redis unavailable – skipping reminder jobs');
      return [];
    }
    const q = new Queue('calendar-reminders', { connection: conn });
    const ids: string[] = [];
    try {
      const t = scheduledAt.getTime();
      const d24 = t - 24 * 3600 * 1000 - Date.now();
      const d1 = t - 3600 * 1000 - Date.now();
      if (d24 > 0) {
        await q.add(
          'REM_24H',
          { leadId },
          { delay: d24, jobId: `cal_rem_24h_${leadId}` },
        );
        ids.push(`cal_rem_24h_${leadId}`);
      }
      if (d1 > 0) {
        await q.add(
          'REM_1H',
          { leadId },
          { delay: d1, jobId: `cal_rem_1h_${leadId}` },
        );
        ids.push(`cal_rem_1h_${leadId}`);
      }
    } finally {
      await q.close();
    }
    return ids;
  }

  private async sendBookingNotifications(params: {
    lead: LeadDocument;
    meetLink: string;
    labelFull: string;
    icsBuf: Buffer;
    leadEmail: string;
    consultantEmail: string;
    adHocFromVoice?: {
      leadBodyHtml: string;
      consultantBodyHtml: string;
    };
  }): Promise<void> {
    const { lead, meetLink, labelFull, icsBuf, leadEmail, consultantEmail, adHocFromVoice } =
      params;
    const apiKey = this.config.get<string>('resendApiKey') ?? '';
    const from = this.config.get<string>('resendFromEmail') ?? '';
    const fe =
      this.frontendBase() || (this.config.get('crmPublicUrl') ?? '');

    if (lead.phone) {
      const msg = `Your discovery call is confirmed! Here are your details:\n\nDate: ${labelFull}\nJoin here: ${meetLink}\n\nYou'll also receive a calendar invite on your email. See you on the call!`;
      await this.whatsapp.sendText(lead.phone, msg);
    }

    if (apiKey && leadEmail) {
      const resend = new Resend(apiKey);
      const leadHtml = adHocFromVoice
        ? `${adHocFromVoice.leadBodyHtml}<p style="margin-top:20px"><strong>Google Meet:</strong> <a href="${meetLink}">Join here</a></p><p>Time: ${escapeHtml(labelFull)}</p>`
        : `<p>Hi ${escapeHtml(lead.name)},</p><p>Your call is confirmed.</p><p><a href="${meetLink}">Join Google Meet</a></p>`;
      await resend.emails.send({
        from,
        to: leadEmail,
        subject: `Your Franchise Discovery Call is confirmed — ${labelFull}`,
        html: leadHtml,
        attachments: icsBuf.length
          ? [{ filename: 'discovery-call.ics', content: icsBuf }]
          : [],
      });
    }

    if (apiKey && consultantEmail) {
      const resend = new Resend(apiKey);
      const consultantHtml = adHocFromVoice
        ? `${adHocFromVoice.consultantBodyHtml}<p style="margin-top:20px"><strong>Meet:</strong> <a href="${meetLink}">Join</a> · <a href="${fe}/leads/${lead._id}">Open lead in CRM</a></p><p>Phone: ${escapeHtml(lead.phone ?? '—')}</p><p>When: ${escapeHtml(labelFull)}</p>`
        : `<p>Lead: ${escapeHtml(lead.name)}</p><p>Email: ${escapeHtml(leadEmail)}</p><p>Phone: ${escapeHtml(lead.phone ?? '—')}</p><p><a href="${meetLink}">Meet</a> · <a href="${fe}/leads/${lead._id}">CRM</a></p>`;
      await resend.emails.send({
        from,
        to: consultantEmail,
        subject: `New discovery call booked — ${lead.name} on ${labelFull}`,
        html: consultantHtml,
      });
    }

    await this.notifications.notifyAdminsAndManagers({
      type: 'discovery_call_booked',
      description: `Discovery call booked: ${lead.name} — ${labelFull}`,
      leadId: String(lead._id),
    });
  }

  async cancelBooking(leadId: string): Promise<void> {
    const lead = await this.leadModel.findById(leadId).exec();
    if (!lead?.discoveryCall?.googleEventId) {
      throw new BadRequestException('No scheduled call to cancel');
    }
    const integration = await this.getPrimaryIntegration();
    const uid = String(integration.userId);
    const oauth2 = await this.getGoogleOAuth2ForUser(uid);
    const ge = lead.discoveryCall.googleEventId;
    if (ge) {
      await googleDeleteEvent(oauth2, ge).catch(() => {});
    }
    const oe = lead.discoveryCall.outlookEventId;
    if (oe) {
      const tok = await this.getOutlookAccessToken(uid);
      if (tok) await outlookDeleteEvent(tok, oe).catch(() => {});
    }
    await this.cancelReminderJobs(leadId);
    const app = await this.settings.getSettings();
    const ghl = app?.availabilitySettings?.ghlBookingLink ?? app?.calendlyLink ?? '';
    if (lead.phone && ghl) {
      await this.whatsapp.sendText(
        lead.phone,
        `Your discovery call has been cancelled. Here's the link to pick a new time: ${ghl}`,
      );
    }
    lead.discoveryCall = {
      ...lead.discoveryCall,
      status: 'cancelled',
    };
    lead.stage = 'slot_offer';
    await lead.save();
    await this.activities.createForLead(leadId, {
      type: 'call_cancelled',
      description: 'Discovery call cancelled.',
      addedBy: 'Calendar',
    });
  }

  async rescheduleBooking(
    leadId: string,
    newStart: Date,
    newEnd: Date,
  ): Promise<void> {
    const lead = await this.leadModel.findById(leadId).exec();
    if (!lead?.discoveryCall?.googleEventId) {
      throw new BadRequestException('No scheduled call');
    }
    const integration = await this.getPrimaryIntegration();
    const uid = String(integration.userId);
    const oauth2 = await this.getGoogleOAuth2ForUser(uid);
    await googlePatchEvent(oauth2, lead.discoveryCall.googleEventId!, {
      start: { dateTime: newStart.toISOString(), timeZone: 'Asia/Kolkata' },
      end: { dateTime: newEnd.toISOString(), timeZone: 'Asia/Kolkata' },
    });
    const oe = lead.discoveryCall.outlookEventId;
    if (oe) {
      const tok = await this.getOutlookAccessToken(uid);
      if (tok) {
        await outlookPatchEvent(tok, oe, {
          start: {
            dateTime: newStart.toISOString().slice(0, 19),
            timeZone: 'India Standard Time',
          },
          end: {
            dateTime: newEnd.toISOString().slice(0, 19),
            timeZone: 'India Standard Time',
          },
        }).catch(() => {});
      }
    }
    await this.cancelReminderJobs(leadId);
    await this.scheduleReminderJobs(leadId, newStart);
    lead.discoveryCall = {
      ...lead.discoveryCall,
      scheduledAt: newStart,
      endTime: newEnd,
    };
    await lead.save();
    await this.activities.createForLead(leadId, {
      type: 'call_rescheduled',
      description: 'Discovery call rescheduled.',
      addedBy: 'Calendar',
    });
  }

  private async cancelReminderJobs(leadId: string): Promise<void> {
    let conn: import('ioredis').default;
    try {
      conn = getSingletonBullConnection();
    } catch {
      return;
    }
    const q = new Queue('calendar-reminders', { connection: conn });
    try {
      for (const id of [`cal_rem_24h_${leadId}`, `cal_rem_1h_${leadId}`]) {
        const j = await q.getJob(id);
        await j?.remove();
      }
    } finally {
      await q.close();
    }
  }

  async cacheVoiceSlots(leadId: string, slots: unknown): Promise<void> {
    let redis: import('ioredis').default;
    try {
      redis = getSingletonBullConnection();
    } catch {
      return;
    }
    await redis.setex(
      `voice_slots_${leadId}`,
      VOICE_SLOT_TTL_SEC,
      JSON.stringify(slots),
    );
  }

  async getCachedVoiceSlots(leadId: string): Promise<
    | Array<{
        index: number;
        startTime: string;
        endTime: string;
        label: string;
        labelShort: string;
      }>
    | null
  > {
    let redis: import('ioredis').default;
    try {
      redis = getSingletonBullConnection();
    } catch {
      return null;
    }
    const raw = await redis.get(`voice_slots_${leadId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Array<{
        index: number;
        startTime: string;
        endTime: string;
        label: string;
        labelShort: string;
      }>;
    } catch {
      return null;
    }
  }

  async getIntegrationStatus(userId: string) {
    const doc = await this.integrationModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .lean()
      .exec();
    return {
      google: {
        connected: !!doc?.isGoogleConnected,
        email: doc?.googleEmail ?? '',
        lastSyncAt: doc?.lastGoogleSyncAt ?? null,
      },
      outlook: {
        connected: !!doc?.isOutlookConnected,
        email: doc?.outlookEmail ?? '',
      },
    };
  }

  async getEvents(userId: string, timeMin: string, timeMax: string) {
    const integration = await this.integrationModel
      .findOne({ userId: new Types.ObjectId(userId), isGoogleConnected: true })
      .lean<CalendarIntegration & { _id: string }>()
      .exec();
    if (!integration?.isGoogleConnected) {
      throw new BadRequestException('Google Calendar not connected');
    }
    const oauth2 = await this.getGoogleOAuth2ForUser(userId);
    return googleListEvents(oauth2, {
      timeMin,
      timeMax,
      calendarId: integration.googleCalendarId || 'primary',
    });
  }

  async createManualEvent(
    userId: string,
    input: {
      title: string;
      startTime: string;
      endTime: string;
      description?: string;
      attendeeEmail?: string;
      createMeet?: boolean;
    },
  ) {
    const integration = await this.integrationModel
      .findOne({ userId: new Types.ObjectId(userId), isGoogleConnected: true })
      .lean<CalendarIntegration & { _id: string }>()
      .exec();
    if (!integration?.isGoogleConnected) {
      throw new BadRequestException('Google Calendar not connected');
    }
    const oauth2 = await this.getGoogleOAuth2ForUser(userId);

    const eventBody: Record<string, unknown> = {
      summary: input.title,
      description: input.description ?? '',
      start: { dateTime: input.startTime, timeZone: 'Asia/Kolkata' },
      end: { dateTime: input.endTime, timeZone: 'Asia/Kolkata' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    if (input.attendeeEmail?.trim()) {
      eventBody.attendees = [{ email: input.attendeeEmail.trim() }];
    }

    if (input.createMeet) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: `manual-${userId}-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const created = await googleCreateMeetEvent(oauth2, eventBody);
    return {
      id: created.id,
      meetLink: created.hangoutLink ?? null,
    };
  }

  async rescheduleEvent(userId: string, eventId: string, startTime: string, endTime: string) {
    const integration = await this.integrationModel
      .findOne({ userId: new Types.ObjectId(userId), isGoogleConnected: true })
      .lean<CalendarIntegration & { _id: string }>()
      .exec();
    if (!integration?.isGoogleConnected) {
      throw new BadRequestException('Google Calendar not connected');
    }
    const oauth2 = await this.getGoogleOAuth2ForUser(userId);
    await googlePatchEvent(oauth2, eventId, {
      start: { dateTime: startTime, timeZone: 'Asia/Kolkata' },
      end: { dateTime: endTime, timeZone: 'Asia/Kolkata' },
    });
    return { ok: true };
  }

  async deleteEvent(userId: string, eventId: string) {
    const integration = await this.integrationModel
      .findOne({ userId: new Types.ObjectId(userId), isGoogleConnected: true })
      .lean<CalendarIntegration & { _id: string }>()
      .exec();
    if (!integration?.isGoogleConnected) {
      throw new BadRequestException('Google Calendar not connected');
    }
    const oauth2 = await this.getGoogleOAuth2ForUser(userId);
    await googleDeleteEvent(oauth2, eventId);
    return { ok: true };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
