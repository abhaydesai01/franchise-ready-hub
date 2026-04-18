import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Proxies Calendly webhooks to the Nest API (`POST /api/v1/webhooks/calendly`).
 * Configure Calendly to this URL if the CRM domain is public, or point Calendly directly at the Nest URL.
 */
export async function POST(req: Request) {
  const base =
    process.env.BACKEND_API_BASE_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'BACKEND_API_BASE_URL not configured' },
      { status: 503 },
    );
  }

  const buf = Buffer.from(await req.arrayBuffer());
  const sig =
    req.headers.get('Calendly-Webhook-Signature') ??
    req.headers.get('calendly-webhook-signature') ??
    '';

  try {
    const res = await fetch(`${base}/api/v1/webhooks/calendly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sig ? { 'Calendly-Webhook-Signature': sig } : {}),
      },
      body: buf,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  } catch (e) {
    console.error('[calendly proxy]', e);
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
