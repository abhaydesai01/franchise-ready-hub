import { sendText, formatPhone } from '@/lib/whatsapp';
import { connectDB } from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { BotSession } from '@/models/BotSession';
import { cancelLeadJobs } from '@/lib/queues';
import type { InboundMessageInput } from './inboundTypes';
import { processFreddyMessage } from '@/lib/agent/agent';
import { isFreddyV2EnabledForPhone } from '@/lib/agent/featureFlags';

export async function sendWarmIntroForLead(leadId: string): Promise<void> {
  await connectDB();
  const lead = await Lead.findById(leadId).lean();
  if (!lead?.phone) return;
  const phone = formatPhone(lead.phone);
  const v2EnabledForLead = isFreddyV2EnabledForPhone(phone);

  const opening = v2EnabledForLead
    ? `${(lead.name ?? 'there').split(/\s+/)[0]}, great to connect. Tell me a bit about your business and how long you have been running it.`
    : `${(lead.name ?? 'there').split(/\s+/)[0]}, thanks for your interest. A Franchise Ready advisor will connect with you shortly.`;
  await sendText(phone, opening);

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
      },
    },
    { upsert: true },
  );
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
