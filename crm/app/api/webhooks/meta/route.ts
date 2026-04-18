import { NextResponse } from 'next/server';
import { processMetaPayload } from '@/lib/webhooks/processMetaLeadgen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const verify = process.env.META_VERIFY_TOKEN ?? '';

  if (mode === 'subscribe' && token === verify && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('x-hub-signature-256');
  const ok = await processMetaPayload(raw, sig);
  if (!ok) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
