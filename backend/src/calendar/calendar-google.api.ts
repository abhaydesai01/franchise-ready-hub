import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export async function googleFreeBusy(
  auth: OAuth2Client,
  params: {
    timeMin: string;
    timeMax: string;
    calendarId: string;
  },
): Promise<Array<{ start?: string | null; end?: string | null }>> {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      timeZone: 'Asia/Kolkata',
      items: [{ id: params.calendarId }],
    },
  });
  const busy =
    res.data.calendars?.[params.calendarId]?.busy ??
    ([] as Array<{ start?: string | null; end?: string | null }>);
  return busy;
}

export async function googleCreateMeetEvent(
  auth: OAuth2Client,
  body: Record<string, unknown>,
): Promise<{ id?: string | null; hangoutLink?: string | null }> {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'none',
    requestBody: body as Record<string, unknown>,
  });
  const data = res.data;
  const hangout =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
      ?.uri ||
    '';
  return { id: data.id ?? undefined, hangoutLink: hangout || undefined };
}

export async function googleDeleteEvent(
  auth: OAuth2Client,
  eventId: string,
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'none',
  });
}

export async function googlePatchEvent(
  auth: OAuth2Client,
  eventId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'none',
    requestBody: body as Record<string, unknown>,
  });
}
