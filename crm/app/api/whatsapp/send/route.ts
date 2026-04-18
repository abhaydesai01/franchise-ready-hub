import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { AutomationLog } from '@/models/AutomationLog';
import { sendText, sendTemplate, formatPhone } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  leadId?: string;
  message?: string;
  templateName?: string;
  templateComponents?: Record<string, unknown>[];
};

export async function POST(req: Request) {
  try {
    await connectDB();
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { leadId, message, templateName, templateComponents } = body;
  if (!leadId) {
    return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
  }
  if (!message && !templateName) {
    return NextResponse.json({ error: 'message or templateName is required' }, { status: 400 });
  }

  try {
    const lead = await Lead.findById(leadId);
    if (!lead || !lead.phone) {
      return NextResponse.json({ error: 'Lead not found or missing phone' }, { status: 404 });
    }

    const to = formatPhone(lead.phone);
    const res = templateName
      ? await sendTemplate(to, templateName, templateComponents, 'en')
      : await sendText(to, message ?? '');

    await AutomationLog.create({
      leadId: lead._id,
      stepName: 'manual',
      channel: 'whatsapp',
      direction: 'outbound',
      status: res.success ? 'sent' : 'failed',
      content: message ?? `[template:${templateName}]`,
      waMessageId: res.messageId ?? undefined,
      templateName: templateName ?? undefined,
      errorDetails: res.error ?? undefined,
      sentAt: res.success ? new Date() : undefined,
    });

    return NextResponse.json({
      success: res.success,
      messageId: res.messageId,
      error: res.error,
    });
  } catch (e) {
    console.error('[whatsapp/send]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
