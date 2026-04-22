import { sendText } from '@/lib/whatsapp';
import { enqueueVoiceAgentCall } from '@/lib/queues';
import { Lead } from '@/models/Lead';
import type { BotSessionDocument } from '@/models/BotSession';
import type { HandlerResult } from './handlers';

export function buildVoiceCallContext(session: BotSessionDocument, latestUserMessage: string): string {
  const missing = [];
  if (session.goalTracker?.score_capital == null && !session.scoringEvidence?.capital) missing.push('capital');
  if (session.goalTracker?.score_experience == null && !session.scoringEvidence?.experience)
    missing.push('experience');
  if (session.goalTracker?.score_location == null && !session.scoringEvidence?.location) missing.push('location');
  if (session.goalTracker?.score_commitment == null && !session.scoringEvidence?.commitment)
    missing.push('commitment');
  if (session.goalTracker?.score_timeline == null && !session.scoringEvidence?.timeline) missing.push('timeline');

  return [
    `Lead name: ${session.collectedName ?? 'unknown'}`,
    `Scoring evidence: ${JSON.stringify(session.scoringEvidence ?? {})}`,
    `Missing goals: ${missing.join(', ') || 'none'}`,
    `Last user message: ${latestUserMessage.slice(0, 220)}`,
  ].join(' | ');
}

async function notifyTeam(leadId: string, note: string): Promise<void> {
  const lead = await Lead.findById(leadId).lean();
  const joined = [lead?.notes, note].filter(Boolean).join(' | ');
  await Lead.updateOne(
    { _id: leadId },
    {
      $set: {
        notes: joined,
        lastActivityType: 'freddy_channel_event',
        lastActivity: new Date().toISOString(),
      },
    },
  );
}

export async function dispatchChannelAction(params: {
  session: BotSessionDocument;
  handlerResult: HandlerResult;
  replyText: string;
  latestUserMessage: string;
  bookingLink: string;
}): Promise<void> {
  const { session, handlerResult, replyText, latestUserMessage, bookingLink } = params;
  const phone = session.phone;

  if (handlerResult.action === 'switch_to_voice') {
    await sendText(phone, "Perfect — you'll get a call from the Franchise Ready team in the next 2 minutes. 📞");
    if (session.leadId) {
      await enqueueVoiceAgentCall({
        leadId: String(session.leadId),
        phone,
        name: session.collectedName ?? 'there',
        reason: `immediate_voice_request | ${buildVoiceCallContext(session, latestUserMessage)}`,
      });
      await notifyTeam(String(session.leadId), 'Voice call requested — firing now');
    }
    return;
  }

  if (handlerResult.action === 'switch_to_email') {
    await sendText(phone, 'Perfect. Updates will be shared over email from the Franchise Ready team.');
    return;
  }

  if (handlerResult.action === 'book_call') {
    await sendText(
      phone,
      `${replyText.replace(/\?$/, '.')} Here is the link: ${bookingLink}`,
    );
    return;
  }

  if (handlerResult.action === 'contact_team') {
    await sendText(
      phone,
      "That is a great point to take with Rahul's team directly. Reach us at info@franchise-ready.in or +91 9833393077, and I have already logged this context for follow-up.",
    );
    return;
  }

  if (handlerResult.action === 'opt_out') {
    await sendText(phone, 'Understood. You have been opted out from further messages.');
    return;
  }

  await sendText(phone, replyText);
}

