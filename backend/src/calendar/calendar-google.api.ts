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

export async function googleListEvents(
  auth: OAuth2Client,
  params: {
    timeMin: string;
    timeMax: string;
    calendarId?: string;
  },
): Promise<
  Array<{
    id: string;
    summary: string;
    start: string;
    end: string;
    meetLink?: string;
    allDay: boolean;
    status: string;
  }>
> {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId: params.calendarId || 'primary',
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  });
  return (res.data.items ?? [])
    .filter((e) => e.status !== 'cancelled')
    .map((e) => ({
      id: e.id ?? '',
      summary: e.summary ?? '(No title)',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      meetLink:
        e.hangoutLink ||
        e.conferenceData?.entryPoints?.find(
          (ep) => ep.entryPointType === 'video',
        )?.uri ||
        '',
      allDay: !e.start?.dateTime,
      status: e.status ?? 'confirmed',
    }));
}
