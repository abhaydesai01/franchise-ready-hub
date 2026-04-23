import { getCrmSettings } from '@/models/CrmSettings';
import { Lead } from '@/models/Lead';
import { BotSession, type BotSessionDocument } from '@/models/BotSession';
import { Conversation } from '@/models/Conversation';
import type { InboundMessageInput } from '@/lib/bot/inboundTypes';
import { formatPhone } from '@/lib/whatsapp';
import { classifyIntent, looksLikePassiveScoringSignal, type FreddyIntent } from './classifier';
import { getMissingGoals, getNextQuestion, passiveScoreExtractor } from './goalTracker';
import { routeToHandler, type HandlerResult } from './handlers';
import { generateReply } from './responder';
import { guardrailCheck } from './responder';
import { dispatchChannelAction } from './channelRouter';
import { isFreddyV2EnabledForPhone } from './featureFlags';
import { sendText } from '@/lib/whatsapp';
import { decideWithLlm, isLlmBrainEnabled, type LlmAction, type LlmExtracted } from './llmBrain';

function inboundText(msg: InboundMessageInput): string {
  return (msg.text ?? msg.buttonTitle ?? msg.listReplyId ?? msg.buttonId ?? '').trim();
}

// Collected names that were stored before the classifier fix — treat as placeholders
// so a real WhatsApp profile name overwrites them on the next inbound message.
const STALE_COLLECTED_NAMES = new Set([
  '', 'whatsapp lead',
  'hi', 'hello', 'hey', 'heya', 'hii', 'hiya', 'hai', 'helo', 'hlw', 'hola',
  'yes', 'yeah', 'yep', 'yup', 'sure', 'okay', 'ok', 'great', 'alright',
  'no', 'nope', 'nah',
  'thanks', 'thank you', 'thx', 'ty',
  'test', 'testing',
]);

function shouldUpgradeCollectedName(current: string | undefined | null, profile: string): boolean {
  if (!profile.trim()) return false;
  const c = (current ?? '').trim().toLowerCase();
  return STALE_COLLECTED_NAMES.has(c);
}

async function ensureLead(
  phone: string,
  profileName?: string,
): Promise<{ _id: string; name: string; email?: string }> {
  let lead = await Lead.findOne({ phone }).exec();
  const trimmedProfile = (profileName ?? '').trim();
  if (!lead) {
    lead = await Lead.create({
      name: trimmedProfile || 'WhatsApp lead',
      phone,
      source: 'whatsapp_inbound',
      track: 'not_ready',
      stage: 'new',
      status: 'new',
      score: 0,
      scoreDimensions: [],
    });
  } else if (trimmedProfile && shouldUpgradeCollectedName(lead.name, trimmedProfile)) {
    lead.name = trimmedProfile;
    await lead.save();
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

const EMAIL_RE_SIMPLE = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;

/**
 * Apply the structured data the LLM extracted to the lead and session so the
 * next turn has an up-to-date picture of what we know.
 */
async function applyExtracted(
  session: BotSessionDocument,
  leadId: string,
  extracted: LlmExtracted,
  userText: string,
): Promise<number> {
  const sessionSet: Record<string, unknown> = {};
  const leadSet: Record<string, unknown> = {};
  let passiveCount = 0;

  if (extracted.name && shouldUpgradeCollectedName(session.collectedName, extracted.name)) {
    sessionSet.collectedName = extracted.name;
    sessionSet['goalTracker.has_name'] = true;
    leadSet.name = extracted.name;
  }
  if (extracted.email && EMAIL_RE_SIMPLE.test(extracted.email) && extracted.email !== session.collectedEmail) {
    sessionSet.collectedEmail = extracted.email;
    sessionSet['goalTracker.has_email'] = true;
    leadSet.email = extracted.email;
  }
  if (extracted.isInvestor === true) {
    sessionSet.isInvestor = true;
  }

  const evidenceSnippet = userText.slice(0, 160);
  const dims: Array<keyof LlmExtracted> = ['capital', 'experience', 'location', 'commitment', 'timeline'];
  for (const dim of dims) {
    const score = extracted[dim];
    if (typeof score !== 'number') continue;
    const current = (session.goalTracker as Record<string, unknown> | undefined)?.[`score_${dim}`];
    if (current != null) continue;
    sessionSet[`goalTracker.score_${dim}`] = score;
    sessionSet[`scoringEvidence.${dim}`] = evidenceSnippet;
    passiveCount += 1;
  }

  if (Object.keys(sessionSet).length > 0) {
    await BotSession.updateOne({ _id: session._id }, { $set: sessionSet });
  }
  if (Object.keys(leadSet).length > 0) {
    await Lead.updateOne({ _id: leadId }, { $set: leadSet });
  }
  return passiveCount;
}

/**
 * Map the LLM's intent/action to a HandlerResult so the downstream channel
 * router (book call, voice switch, escalation etc.) behaves the same whether
 * the decision came from the LLM or the deterministic brain.
 */
function toHandlerResult(intent: FreddyIntent, action: LlmAction): HandlerResult {
  switch (action) {
    case 'book_call':
      return { action: 'book_call', note: `LLM: book_call (intent=${intent})` };
    case 'switch_to_voice':
      return { action: 'switch_to_voice', data: { immediate: true }, note: 'LLM: user prefers voice' };
    case 'switch_to_email':
      return { action: 'switch_to_email', note: 'LLM: user prefers email' };
    case 'escalate':
      return { action: 'contact_team', note: `LLM: escalate to human (intent=${intent})` };
    case 'opt_out':
      return { action: 'opt_out', note: 'LLM: lead opted out' };
    default:
      return { action: 'respond', note: `LLM: respond (intent=${intent})` };
  }
}

export async function processFreddyMessage(input: InboundMessageInput): Promise<void> {
  const phone = formatPhone(input.from);
  const text = inboundText(input);
  if (!text) return;
  const v2EnabledForLead = isFreddyV2EnabledForPhone(phone);
  console.log(`[freddy] inbound phone=${phone} text=${JSON.stringify(text)} v2=${v2EnabledForLead}`);

  const lead = await ensureLead(phone, input.profileName);
  const session = await ensureSession(lead, phone);
  if (input.profileName && shouldUpgradeCollectedName(session.collectedName, input.profileName)) {
    session.collectedName = input.profileName.trim();
    session.goalTracker = { ...(session.goalTracker ?? {}), has_name: true };
    await session.save();
  }
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

  // Load the full conversation so the LLM can see the last N turns.
  const conversation = session.conversationId
    ? await Conversation.findById(session.conversationId).lean()
    : null;

  const missingGoalsPre = getMissingGoals(session);
  const suggestedNextQuestion = getNextQuestion(session, missingGoalsPre);

  let intent: FreddyIntent = 'out_of_scope';
  let handlerResult: HandlerResult = { action: 'respond', note: 'default' };
  let replyText = '';
  let guardrailFailed = false;
  let passiveSignalCount = 0;
  let brain: 'llm' | 'deterministic' = 'deterministic';
  let questionAsked: string | null = null;

  // --- PRIMARY PATH: LLM brain ---------------------------------------------
  if (isLlmBrainEnabled()) {
    const decision = await decideWithLlm({
      session,
      conversation,
      latestUserText: text,
      missingGoals: missingGoalsPre,
      suggestedNextQuestion,
      previousAssistantReply: session.lastAssistantText ?? null,
    });
    if (decision) {
      brain = 'llm';
      intent = decision.intent;
      handlerResult = toHandlerResult(intent, decision.action);
      passiveSignalCount = await applyExtracted(session, lead._id, decision.extracted, text);
      if (decision.action === 'opt_out') {
        await BotSession.updateOne({ _id: session._id }, { $set: { optedOut: true } });
      }
      const checked = await guardrailCheck(decision.reply);
      replyText = checked.safeReply;
      guardrailFailed = checked.failed;
      // If the reply ends with a question, stash it for loop detection.
      questionAsked = /\?\s*$/.test(replyText) ? replyText.split(/[.!]/).slice(-1)[0].trim() : null;
    } else {
      console.warn('[freddy:llm] decision was null — falling back to deterministic brain');
    }
  }

  // --- FALLBACK PATH: deterministic brain ---------------------------------
  if (brain === 'deterministic') {
    intent = classifyIntent(text);
    handlerResult = await routeToHandler(session, intent, text);

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
    const reply = await generateReply({
      session: freshSession,
      intent,
      missingGoals,
      nextQuestion,
      handlerResult,
      userText: text,
    });
    replyText = reply.text;
    guardrailFailed = reply.guardrailFailed;
    questionAsked = reply.questionAsked;
  }

  const freshSession = (await BotSession.findById(session._id).exec()) ?? session;
  const { calendlyLink } = await getCrmSettings();
  const bookingLink = calendlyLink || 'https://cal.com/franchise-ready/discovery';
  console.log(
    `[freddy] reply phone=${phone} brain=${brain} intent=${intent} action=${handlerResult.action} passiveScores=${passiveSignalCount} text=${JSON.stringify(replyText)}`,
  );
  await dispatchChannelAction({
    session: freshSession,
    handlerResult,
    replyText,
    latestUserMessage: text,
    bookingLink,
  });

  await appendConversation(freshSession, {
    role: 'assistant',
    text: replyText,
    intent,
    scoringSignal: passiveSignalCount > 0 ? `passive:${passiveSignalCount}` : undefined,
  });

  const previousQuestion = (freshSession.lastQuestionAsked ?? '').trim();
  const askedNow = (questionAsked ?? '').trim();
  const isRepeatedQuestion = Boolean(askedNow) && askedNow === previousQuestion;
  const nextRepeatCount = isRepeatedQuestion ? (freshSession.repeatCount ?? 0) + 1 : 0;

  await BotSession.updateOne(
    { _id: freshSession._id },
    {
      $set: {
        lastIntent: intent,
        lastIntentAt: new Date(),
        lastMessageAt: new Date(),
        lastQuestionAsked: askedNow || null,
        lastQuestionSentAt: askedNow ? new Date() : freshSession.lastQuestionSentAt,
        lastAssistantText: replyText,
        repeatCount: nextRepeatCount,
      },
    },
  );

  await updateFreddyMetrics(lead._id, {
    totalMessages: 1,
    passiveScores: passiveSignalCount,
    guardrailFails: guardrailFailed ? 1 : 0,
    channelSwitches:
      handlerResult.action === 'switch_to_voice' || handlerResult.action === 'switch_to_email' ? 1 : 0,
    outOfScopeCount: intent === 'out_of_scope' ? 1 : 0,
  });
}

export async function getOpeningMessage(session: BotSessionDocument): Promise<string> {
  const name = session.collectedName?.split(/\s+/)[0] ?? 'there';
  return `${name}, great to connect. Tell me a bit about your business and how long you have been running it.`;
}
