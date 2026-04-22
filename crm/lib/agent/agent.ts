import { getCrmSettings } from '@/models/CrmSettings';
import { Lead } from '@/models/Lead';
import { BotSession, type BotSessionDocument } from '@/models/BotSession';
import { Conversation } from '@/models/Conversation';
import type { InboundMessageInput } from '@/lib/bot/inboundTypes';
import { formatPhone } from '@/lib/whatsapp';
import { classifyIntent, looksLikePassiveScoringSignal } from './classifier';
import { getMissingGoals, getNextQuestion, passiveScoreExtractor } from './goalTracker';
import { routeToHandler } from './handlers';
import { generateReply } from './responder';
import { dispatchChannelAction } from './channelRouter';
import { isFreddyV2EnabledForPhone } from './featureFlags';
import { sendText } from '@/lib/whatsapp';

function inboundText(msg: InboundMessageInput): string {
  return (msg.text ?? msg.buttonTitle ?? msg.listReplyId ?? msg.buttonId ?? '').trim();
}

async function ensureLead(phone: string): Promise<{ _id: string; name: string; email?: string }> {
  let lead = await Lead.findOne({ phone }).exec();
  if (!lead) {
    lead = await Lead.create({
      name: 'WhatsApp lead',
      phone,
      source: 'whatsapp_inbound',
      track: 'not_ready',
      stage: 'new',
      status: 'new',
      score: 0,
      scoreDimensions: [],
    });
  }
  return { _id: String(lead._id), name: lead.name, email: lead.email ?? undefined };
}

async function ensureSession(lead: { _id: string; name: string; email?: string }, phone: string) {
  let session = await BotSession.findOne({ phone }).exec();
  if (!session) {
    session = await BotSession.create({
      phone,
      leadId: lead._id,
      collectedName: lead.name,
      collectedEmail: lead.email,
      goalTracker: {
        has_name: Boolean(lead.name),
        has_email: Boolean(lead.email),
        has_phone: Boolean(phone),
      },
    });
  }
  if (!session.conversationId) {
    const convo = await Conversation.create({ leadId: lead._id, phone, messages: [] });
    session.conversationId = convo._id;
    await session.save();
  }
  return session;
}

async function appendConversation(
  session: BotSessionDocument,
  payload: { role: 'user' | 'assistant'; text: string; intent?: string; scoringSignal?: string },
): Promise<void> {
  if (!session.conversationId) return;
  const convo = await Conversation.findById(session.conversationId).exec();
  if (!convo) return;
  await convo.appendMessage(payload);
}

async function updateFreddyMetrics(leadId: string, updates: {
  totalMessages?: number;
  passiveScores?: number;
  directScores?: number;
  guardrailFails?: number;
  channelSwitches?: number;
  outOfScopeCount?: number;
}): Promise<void> {
  const inc: Record<string, number> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (!v) continue;
    inc[`freddyMetrics.${k}`] = v;
  }

  const lead = await Lead.findById(leadId).lean();
  const set: Record<string, unknown> = {
    'freddyMetrics.lastResponseTime': new Date(),
  };
  if (!lead?.freddyMetrics?.firstResponseTime) {
    set['freddyMetrics.firstResponseTime'] = new Date();
  }

  await Lead.updateOne(
    { _id: leadId },
    {
      ...(Object.keys(inc).length > 0 ? { $inc: inc } : {}),
      $set: set,
    },
  );
}

export async function processFreddyMessage(input: InboundMessageInput): Promise<void> {
  const phone = formatPhone(input.from);
  const text = inboundText(input);
  if (!text) return;
  const v2EnabledForLead = isFreddyV2EnabledForPhone(phone);
  console.log(`[freddy] inbound phone=${phone} text=${JSON.stringify(text)} v2=${v2EnabledForLead}`);

  const lead = await ensureLead(phone);
  const session = await ensureSession(lead, phone);
  if (session.optedOut) {
    console.log(`[freddy] skipped (optedOut) phone=${phone}`);
    return;
  }

  if (!v2EnabledForLead) {
    await sendText(
      phone,
      'Thanks for reaching out. A Franchise Ready team member will continue this conversation shortly.',
    );
    await updateFreddyMetrics(lead._id, { totalMessages: 1 });
    return;
  }

  await appendConversation(session, { role: 'user', text });

  const intent = classifyIntent(text);
  const handlerResultPromise = routeToHandler(session, intent, text);

  let passiveSignalCount = 0;
  if (looksLikePassiveScoringSignal(text.toLowerCase())) {
    const extracted = await passiveScoreExtractor(text);
    if (extracted) {
      const set: Record<string, unknown> = {};
      for (const [dimension, score] of Object.entries(extracted)) {
        set[`goalTracker.score_${dimension}`] = score;
        set[`scoringEvidence.${dimension}`] = text.slice(0, 120);
      }
      await BotSession.updateOne({ _id: session._id }, { $set: set });
      passiveSignalCount = Object.keys(extracted).length;
    }
  }

  const freshSession = (await BotSession.findById(session._id).exec()) ?? session;
  const missingGoals = getMissingGoals(freshSession);
  const nextQuestion = getNextQuestion(freshSession, missingGoals);
  const handlerResult = await handlerResultPromise;

  const reply = await generateReply({
    session: freshSession,
    intent,
    missingGoals,
    nextQuestion,
    handlerResult,
  });

  const { calendlyLink } = await getCrmSettings();
  const bookingLink = calendlyLink || 'https://cal.com/franchise-ready/discovery';
  console.log(
    `[freddy] reply phone=${phone} intent=${intent} action=${handlerResult.action} passiveScores=${passiveSignalCount} text=${JSON.stringify(reply.text)}`,
  );
  await dispatchChannelAction({
    session: freshSession,
    handlerResult,
    replyText: reply.text,
    latestUserMessage: text,
    bookingLink,
  });

  await appendConversation(freshSession, {
    role: 'assistant',
    text: reply.text,
    intent,
    scoringSignal: passiveSignalCount > 0 ? `passive:${passiveSignalCount}` : undefined,
  });

  await BotSession.updateOne(
    { _id: freshSession._id },
    {
      $set: {
        lastIntent: intent,
        lastIntentAt: new Date(),
        lastMessageAt: new Date(),
      },
    },
  );

  await updateFreddyMetrics(lead._id, {
    totalMessages: 1,
    passiveScores: passiveSignalCount,
    guardrailFails: reply.guardrailFailed ? 1 : 0,
    channelSwitches:
      handlerResult.action === 'switch_to_voice' || handlerResult.action === 'switch_to_email' ? 1 : 0,
    outOfScopeCount: intent === 'out_of_scope' ? 1 : 0,
  });
}

export async function getOpeningMessage(session: BotSessionDocument): Promise<string> {
  const name = session.collectedName?.split(/\s+/)[0] ?? 'there';
  return `${name}, great to connect. Tell me a bit about your business and how long you have been running it.`;
}

