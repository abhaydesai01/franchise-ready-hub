/**
 * Fire-and-forget NestJS scorecard pipeline (PDF + WhatsApp + email + activity).
 * Requires BACKEND_API_BASE_URL (e.g. http://localhost:3001) and SCORECARD_INTERNAL_SECRET.
 */
export function triggerScorecardGeneration(leadId: string): void {
  const base =
    process.env.BACKEND_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  const secret = process.env.SCORECARD_INTERNAL_SECRET?.trim();
  if (!base || !secret) {
    console.warn(
      '[scorecard] Set BACKEND_API_BASE_URL and SCORECARD_INTERNAL_SECRET to enable Nest scorecard delivery.',
    );
    return;
  }

  const url = `${base.replace(/\/$/, '')}/api/v1/internal/scorecard/${leadId}/generate`;
  void fetch(url, {
    method: 'POST',
    headers: { 'x-internal-api-key': secret },
  })
    .then(async (res) => {
      if (!res.ok) {
        const t = await res.text();
        console.error('[scorecard] Nest error', res.status, t);
      }
    })
    .catch((e) => console.error('[scorecard] request failed', e));
}
