export async function outlookCreateEvent(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Outlook create ${res.status}`);
  }
  return { id: String(json.id) };
}

export async function outlookDeleteEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`Outlook delete ${res.status}: ${t}`);
  }
}

export async function outlookPatchEvent(
  accessToken: string,
  eventId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Outlook patch ${res.status}: ${t}`);
  }
}
