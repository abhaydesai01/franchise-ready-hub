import { getCrmSettings } from '@/models/CrmSettings';
import { Lead } from '@/models/Lead';
import { BotSession, type BotSessionDocument } from '@/models/BotSession';
import { Conversation } from '@/models/Conversation';
import type { InboundMessageInput } from '@/lib/bot/inboundTypes';
import { formatPhone, sendText, sendButtons, sendList } from '@/lib/whatsapp';
import { enqueueVoiceAgentCall } from '@/lib/queues';
import { classifyIntent, type FreddyIntent } from './classifier';
import { guardrailCheck } from './responder';
import { isFreddyV2EnabledForPhone } from './featureFlags';
import { decideWithLlm, isLlmBrainEnabled } from './llmBrain';
import {
  acknowledgement,
  getCurrentStep,
  nextStepAfter,
  parseButtonReply,
  parseTextForStep,
  renderPrompt,
  scoresFromAnswers,
  softRetry,
  type FlowAnswers,
  type FlowStepId,
  type Prompt,
} from './flowEngine';

function inboundText(msg: InboundMessageInput): string {
  return (msg.text ?? msg.buttonTitle ?? msg.listReplyId ?? msg.buttonId ?? '').trim();
}

function inboundReplyId(msg: InboundMessageInput): string | null {
  return (msg.buttonId ?? msg.listReplyId ?? null) || null;
}

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
      flowAnswers: lead.email ? { email: lead.email } : {},
    });
  } else {
    // Back-fill flowAnswers for sessions created before the flow engine shipped.
    const fa = (session.flowAnswers ?? {}) as Record<string, unknown>;
    let dirty = false;
    if (!fa.email && lead.email) {
      fa.email = lead.email;
      dirty = true;
    }
    if (dirty) {
      session.flowAnswers = fa;
      await session.save();
    }
  }
  if (!session.conversationId) {
    const convo = await Conversation.create({ leadId: lead._id, phone, messages: [] });
    session.conversationId = convo._id;
    await session.save();
  }
  return session;
}

async function appendUser(session: BotSessionDocument, text: string): Promise<void> {
  if (!session.conversationId) return;
  const convo = await Conversation.findById(session.conversationId).exec();
  if (!convo) return;
  await convo.appendMessage({ role: 'user', text });
}

async function appendAssistant(
  session: BotSessionDocument,
  text: string,
  intent?: string,
): Promise<void> {
  if (!session.conversationId) return;
  const convo = await Conversation.findById(session.conversationId).exec();
  if (!convo) return;
  await convo.appendMessage({ role: 'assistant', text, intent });
}

function promptToTranscript(p: Prompt | null): string {
  if (!p) return '';
  if (p.type === 'text') return p.text;
  if (p.type === 'buttons') {
    const labels = p.buttons.map((b) => b.title).join(' / ');
    return `${p.body} [${labels}]`;
  }
  const labels = p.sections.flatMap((s) => s.rows.map((r) => r.title)).join(' / ');
  return `${p.body} [${labels}]`;
}

async function sendPrompt(phone: string, prompt: Prompt): Promise<void> {
  if (prompt.type === 'text') {
    await sendText(phone, prompt.text);
  } else if (prompt.type === 'buttons') {
    await sendButtons(phone, prompt.body, prompt.buttons);
  } else {
    await sendList(phone, prompt.body, prompt.buttonLabel, prompt.sections);
  }
}

/** Persist a flow-step answer to session, update lead where relevant, add scores. */
async function applyFlowAnswer(
  session: BotSessionDocument,
  leadId: string,
  answer: Partial<FlowAnswers>,
): Promise<void> {
  const merged: FlowAnswers = { ...(session.flowAnswers ?? {}), ...answer };
  const sessionSet: Record<string, unknown> = { flowAnswers: merged };
  const leadSet: Record<string, unknown> = {};
  const scorecardSet: Record<string, unknown> = {};

  if (answer.email) {
    sessionSet.collectedEmail = answer.email;
    sessionSet['goalTracker.has_email'] = true;
    leadSet.email = answer.email;
  }
  if (answer.brand) {
    leadSet.company = answer.brand;
  }
  if (answer.category) scorecardSet['scorecardAnswers.businessCategory'] = answer.category;
  if (answer.outlets) scorecardSet['scorecardAnswers.outlets'] = answer.outlets;
  if (answer.city) scorecardSet['scorecardAnswers.targetLocation'] = answer.city;
  if (answer.serviceType) scorecardSet['scorecardAnswers.serviceType'] = answer.serviceType;
  if (answer.sopsDocumented) scorecardSet['scorecardAnswers.sopsDocumented'] = answer.sopsDocumented;
  if (answer.mainGoal) scorecardSet['scorecardAnswers.mainGoal'] = answer.mainGoal;

  const scores = scoresFromAnswers(merged);
  for (const [k, v] of Object.entries(scores)) {
    sessionSet[`goalTracker.${k}`] = v;
  }

  await BotSession.updateOne({ _id: session._id }, { $set: sessionSet });
  if (Object.keys(leadSet).length > 0 || Object.keys(scorecardSet).length > 0) {
    await Lead.updateOne({ _id: leadId }, { $set: { ...leadSet, ...scorecardSet } });
  }
}

async function completeFlow(session: BotSessionDocument): Promise<void> {
  await BotSession.updateOne(
    { _id: session._id },
    { $set: { flowCompletedAt: new Date(), currentStep: 'done' } },
  );
}

async function updateFreddyMetrics(
  leadId: string,
  updates: {
    totalMessages?: number;
    passiveScores?: number;
    directScores?: number;
    guardrailFails?: number;
    channelSwitches?: number;
    outOfScopeCount?: number;
  },
): Promise<void> {
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

async function handleClose(
  session: BotSessionDocument,
  leadId: string,
  choice: FlowAnswers['closeChoice'],
  latestUserText: string,
): Promise<void> {
  const { calendlyLink } = await getCrmSettings();
  const bookingLink = calendlyLink || 'https://cal.com/franchise-ready/discovery';
  if (choice === 'send_link') {
    await sendText(session.phone, `Here is the Discovery Call link: ${bookingLink}`);
  } else if (choice === 'call_me') {
    await sendText(
      session.phone,
      `Perfect — you will get a call from the Franchise Ready team in the next 2 minutes.`,
    );
    await enqueueVoiceAgentCall({
      leadId,
      phone: session.phone,
      name: session.collectedName ?? 'there',
      reason: `close_booking_call | latest=${latestUserText.slice(0, 120)}`,
    });
  } else {
    await sendText(
      session.phone,
      `No problem. Whenever you are ready, just message me here and I will share the Discovery Call link.`,
    );
  }
}

export async function processFreddyMessage(input: InboundMessageInput): Promise<void> {
  const phone = formatPhone(input.from);
  const text = inboundText(input);
  if (!text) return;

  const v2EnabledForLead = isFreddyV2EnabledForPhone(phone);
  const replyId = inboundReplyId(input);
  console.log(
    `[freddy] inbound phone=${phone} text=${JSON.stringify(text)} replyId=${replyId ?? 'none'} v2=${v2EnabledForLead}`,
  );

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

  await appendUser(session, text);

  let currentStep = getCurrentStep(session);
  console.log(`[freddy] step=${currentStep}`);

  // ---- Fast path: the user tapped a button / list row ---------------------
  let structuredAnswer: Partial<FlowAnswers> | null = null;
  if (replyId) {
    structuredAnswer = parseButtonReply(currentStep, replyId);
  }

  // ---- LLM pass (primary brain) -------------------------------------------
  let sideReply = '';
  let sideIntent: FreddyIntent | null = null;
  let action: 'respond' | 'book_call' | 'switch_to_voice' | 'switch_to_email' | 'escalate' | 'opt_out' = 'respond';
  let brain: 'llm' | 'deterministic' = 'deterministic';

  const conversation = session.conversationId
    ? await Conversation.findById(session.conversationId).lean()
    : null;

  if (isLlmBrainEnabled() && currentStep !== 'done') {
    const decision = await decideWithLlm({
      session,
      conversation,
      latestUserText: text,
      currentStep,
      previousAssistantReply: session.lastAssistantText ?? null,
    });
    if (decision) {
      brain = 'llm';
      sideReply = decision.sideReply;
      sideIntent = decision.sideIntent;
      action = decision.action;
      if (!structuredAnswer && decision.userAnsweredCurrentStep && decision.stepAnswer) {
        structuredAnswer = decision.stepAnswer;
      }
    }
  }

  // ---- Deterministic fallback / supplement --------------------------------
  if (!structuredAnswer) {
    structuredAnswer = parseTextForStep(currentStep, text);
  }
  if (brain === 'deterministic') {
    sideIntent = classifyIntent(text);
  }

  // ---- Side-intent side-effects that SHORT-CIRCUIT the flow --------------
  if (action === 'opt_out' || sideIntent === 'opt_out') {
    await BotSession.updateOne({ _id: session._id }, { $set: { optedOut: true } });
    await sendText(phone, 'Understood. You have been opted out from further messages.');
    await appendAssistant(session, 'Opted out.', 'opt_out');
    return;
  }

  if (action === 'switch_to_voice' || sideIntent === 'prefer_voice') {
    await sendText(phone, 'Perfect — you will get a call from the Franchise Ready team in the next 2 minutes.');
    await enqueueVoiceAgentCall({
      leadId: lead._id,
      phone,
      name: session.collectedName ?? 'there',
      reason: `voice_request_mid_flow | step=${currentStep} | latest=${text.slice(0, 120)}`,
    });
    await appendAssistant(session, 'Voice call queued.', 'prefer_voice');
    await updateFreddyMetrics(lead._id, { totalMessages: 1, channelSwitches: 1 });
    return;
  }

  if (action === 'escalate' || sideIntent === 'frustration_signal') {
    const msg = sideReply
      || "That is a fair call. Let me get a human from the team to take over quickly — someone will reach out shortly.";
    await sendText(phone, msg);
    await appendAssistant(session, msg, 'frustration_signal');
    await Lead.updateOne(
      { _id: lead._id },
      {
        $set: {
          lastActivityType: 'freddy_frustration_signal',
          lastActivity: new Date().toISOString(),
        },
      },
    );
    await updateFreddyMetrics(lead._id, { totalMessages: 1 });
    return;
  }

  // ---- Persist step answer, advance ---------------------------------------
  let advanced = false;
  if (structuredAnswer) {
    await applyFlowAnswer(session, lead._id, structuredAnswer);
    advanced = true;
  }

  // Reload session so flow state is fresh.
  const fresh = (await BotSession.findById(session._id).exec()) ?? session;
  const stepBefore = currentStep;
  const stepAfter = getCurrentStep(fresh);

  // Handle close_booking special transition when the user picks an option.
  if (stepBefore === 'close_booking' && structuredAnswer?.closeChoice) {
    await handleClose(fresh, lead._id, structuredAnswer.closeChoice, text);
    await appendAssistant(fresh, `Close choice: ${structuredAnswer.closeChoice}`, 'confirm_booking');
    await completeFlow(fresh);
    await updateFreddyMetrics(lead._id, { totalMessages: 1 });
    return;
  }

  // ---- Build outgoing messages -------------------------------------------
  const messagesToSend: { kind: 'text' | 'prompt'; payload: string | Prompt }[] = [];

  const substantiveSideIntents = new Set<FreddyIntent>([
    'faq_cost', 'faq_process', 'faq_about_fr', 'faq_timeline',
    'faq_programmes', 'faq_success', 'faq_team', 'faq_whatsapp_bot',
    'objection_not_ready', 'objection_think', 'objection_price', 'objection_not_sure',
    'high_value_signal', 'signal_ready_to_book', 'confirm_booking', 'reschedule',
    'investor_intent', 'out_of_scope',
  ]);
  const isSubstantiveSide = sideIntent !== null && substantiveSideIntents.has(sideIntent);

  // Guard: never send a sideReply that would duplicate the step prompt we're
  // about to send. If the user didn't advance AND didn't ask something real,
  // stay silent and let the deterministic prompt speak.
  const suppressSideReply = sideReply.length === 0 || (!advanced && !isSubstantiveSide);

  // 1. Side reply (only for substantive off-flow questions).
  if (!suppressSideReply) {
    const checked = await guardrailCheck(sideReply);
    if (checked.safeReply) {
      messagesToSend.push({ kind: 'text', payload: checked.safeReply });
    }
  } else if (advanced) {
    // Warm bridge for "got it, <brand>" etc.
    const ack = acknowledgement(stepBefore, fresh.flowAnswers as FlowAnswers, fresh);
    if (ack) messagesToSend.push({ kind: 'text', payload: ack });
  } else if (!isSubstantiveSide && !replyId) {
    // User typed something but we couldn't parse it and there's no side question.
    // Send a gentle nudge specific to the step, then re-issue the prompt.
    const nudge = softRetry(stepBefore);
    if (nudge) messagesToSend.push({ kind: 'text', payload: nudge });
  }

  // 2. Next step's prompt (or close message if flow is done).
  if (stepAfter === 'done') {
    // Flow finished but close_booking didn't fire — safety net.
    const closeText =
      'Thank you for sharing all that. Based on what you told me, a short Discovery Call with Rahul is the right next step. Want me to share the link?';
    messagesToSend.push({ kind: 'text', payload: closeText });
  } else {
    const prompt = renderPrompt(stepAfter, fresh);
    if (prompt) messagesToSend.push({ kind: 'prompt', payload: prompt });
  }

  // ---- Dispatch -----------------------------------------------------------
  for (const m of messagesToSend) {
    if (m.kind === 'text') {
      await sendText(phone, m.payload as string);
      await appendAssistant(fresh, m.payload as string, sideIntent ?? 'respond');
    } else {
      const p = m.payload as Prompt;
      await sendPrompt(phone, p);
      await appendAssistant(fresh, promptToTranscript(p), `flow:${stepAfter}`);
    }
  }

  const lastAssistantText = messagesToSend
    .map((m) => (m.kind === 'text' ? (m.payload as string) : promptToTranscript(m.payload as Prompt)))
    .join(' ');

  await BotSession.updateOne(
    { _id: fresh._id },
    {
      $set: {
        lastIntent: sideIntent ?? `flow:${stepAfter}`,
        lastIntentAt: new Date(),
        lastMessageAt: new Date(),
        lastAssistantText,
        currentStep: stepAfter,
      },
    },
  );

  console.log(
    `[freddy] reply phone=${phone} brain=${brain} stepBefore=${stepBefore} stepAfter=${stepAfter} advanced=${advanced} sideIntent=${sideIntent ?? 'none'} action=${action}`,
  );

  await updateFreddyMetrics(lead._id, {
    totalMessages: 1,
    outOfScopeCount: sideIntent === 'out_of_scope' ? 1 : 0,
  });
}

export async function getOpeningMessage(session: BotSessionDocument): Promise<string> {
  const name = session.collectedName?.split(/\s+/)[0] ?? 'there';
  return `${name}, great to connect. Tell me a bit about your business and how long you have been running it.`;
}
