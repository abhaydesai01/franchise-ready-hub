/** Best-effort extraction for Calendly webhook JSON (API shape varies slightly). */
export type CalendlyInviteePayload = {
  email?: string;
  name?: string;
  uri?: string;
  rescheduled?: boolean;
};

export type CalendlyScheduledEventPayload = {
  uri?: string;
  start_time?: string;
  end_time?: string;
  location?: {
    join_url?: string;
    type?: string;
    location?: string;
    data?: { join_url?: string };
  };
};

export type CalendlyWebhookBody = {
  event?: string;
  payload?: {
    invitee?: CalendlyInviteePayload;
    event?: CalendlyScheduledEventPayload;
    scheduled_event?: CalendlyScheduledEventPayload;
  };
};

export function getEventName(body: CalendlyWebhookBody): string {
  return String(body.event ?? '').toLowerCase();
}

export function extractInvitee(body: CalendlyWebhookBody): CalendlyInviteePayload | null {
  const inv = body.payload?.invitee;
  if (!inv) return null;
  return inv;
}

export function extractScheduledEvent(
  body: CalendlyWebhookBody,
): CalendlyScheduledEventPayload | null {
  const p = body.payload;
  if (!p) return null;
  return p.scheduled_event ?? p.event ?? null;
}

export function extractJoinUrl(ev: CalendlyScheduledEventPayload | null): string {
  if (!ev?.location) return '';
  const loc = ev.location;
  return (
    loc.join_url ??
    loc.data?.join_url ??
    (typeof loc.location === 'string' ? loc.location : '') ??
    ''
  );
}
