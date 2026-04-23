import { sendText, sendButtons, sendList, formatPhone } from '@/lib/whatsapp';
import { connectDB } from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { BotSession } from '@/models/BotSession';
import { cancelLeadJobs } from '@/lib/queues';
import type { InboundMessageInput } from './inboundTypes';
import { processFreddyMessage } from '@/lib/agent/agent';
import { isFreddyV2EnabledForPhone } from '@/lib/agent/featureFlags';
import { getCurrentStep, renderPrompt } from '@/lib/agent/flowEngine';

export async function sendWarmIntroForLead(leadId: string): Promise<void> {
  await connectDB();
  const lead = await Lead.findById(leadId).lean();
  if (!lead?.phone) return;
  const phone = formatPhone(lead.phone);
  const v2EnabledForLead = isFreddyV2EnabledForPhone(phone);

  await BotSession.updateOne(
    { phone },
    {
      $setOnInsert: {
        phone,
        leadId: lead._id,
      },
      $set: {
        collectedName: lead.name,
        collectedEmail: lead.email,
        'goalTracker.has_name': Boolean(lead.name),
        'goalTracker.has_email': Boolean(lead.email),
        'goalTracker.has_phone': Boolean(phone),
        flowAnswers: lead.email ? { email: lead.email } : {},
      },
    },
    { upsert: true },
  );

  if (!v2EnabledForLead) {
    await sendText(
      phone,
      `${(lead.name ?? 'there').split(/\s+/)[0]}, thanks for your interest. A Franchise Ready advisor will connect with you shortly.`,
    );
    return;
  }

  // Drive the structured onboarding flow from message one.
  const session = await BotSession.findOne({ phone }).exec();
  if (!session) return;
  const step = getCurrentStep(session);
  const prompt = renderPrompt(step, session);
  if (!prompt) return;
  if (prompt.type === 'text') {
    await sendText(phone, prompt.text);
  } else if (prompt.type === 'buttons') {
    await sendButtons(phone, prompt.body, prompt.buttons);
  } else {
    await sendList(phone, prompt.body, prompt.buttonLabel, prompt.sections);
  }
  await BotSession.updateOne({ _id: session._id }, { $set: { currentStep: step } });
}

export async function handleInboundMessage(input: InboundMessageInput): Promise<void> {
  await connectDB();
  await processFreddyMessage(input);
}

export async function confirmBookingFromCalendly(leadId: string): Promise<void> {
  await connectDB();
  await cancelLeadJobs(leadId);
  const lead = await Lead.findByIdAndUpdate(
    leadId,
    {
      $set: {
        stage: 'discovery_booked',
        'freddyMetrics.lastResponseTime': new Date(),
      },
    },
    { new: true },
  ).lean();
  if (!lead?.phone) return;

  await BotSession.updateOne(
    { phone: formatPhone(lead.phone) },
    { $set: { 'goalTracker.discovery_booked': true, lastIntent: 'confirm_booking', lastIntentAt: new Date() } },
  );
  await sendText(formatPhone(lead.phone), 'Perfect, your Discovery Call is confirmed. Looking forward to it.');
}
