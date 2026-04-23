import type { BotSessionDocument } from '@/models/BotSession';
import type { FreddyIntent } from './classifier';
import type { HandlerResult } from './handlers';
import { getKbContext } from './knowledgeBase';
import { buildSystemPrompt } from './persona';

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function tooManyQuestions(text: string): boolean {
  const q = text.match(/\?/g);
  return (q?.length ?? 0) > 1;
}

function hasCorporateJargon(textLower: string): boolean {
  return ['synergies', 'value proposition', 'ecosystem'].some((w) => textLower.includes(w));
}

export async function guardrailCheck(reply: string): Promise<{ safeReply: string; failed: boolean }> {
  const textLower = reply.toLowerCase();
  if (
    /(\₹|rs\.?)\s*\d/.test(textLower) ||
    /limited slots|act now|expires/.test(textLower) ||
    hasCorporateJargon(textLower) ||
    tooManyQuestions(reply) ||
    wordCount(reply) > 100
  ) {
    return {
      failed: true,
      safeReply:
        "Great question — that is best covered on a Discovery Call with Rahul where guidance is tailored to your business. Want the booking link?",
    };
  }
  return { failed: false, safeReply: reply };
}

function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return 'there';
  return n.split(/\s+/)[0] ?? n;
}

/**
 * Intent-specific opener. This REPLACES the old one-size-fits-all
 * "thanks for sharing that, really helpful context." opener which felt
 * robotic when the user just said "Hi" or provided an email.
 */
function renderOpener(
  intent: FreddyIntent,
  handlerResult: HandlerResult,
  session: BotSessionDocument,
  userText: string,
): string {
  const name = firstName(session.collectedName);

  switch (intent) {
    case 'greeting':
      return `Hi ${name}! I am Freddy from Franchise Ready — here to answer questions and line up the right next step for your business.`;

    case 'provide_email': {
      const email = (session.collectedEmail ?? userText).trim().toLowerCase();
      return `Got it, I have noted ${email}.`;
    }

    case 'provide_phone':
      return `Thanks ${name}, I have your number saved.`;

    case 'provide_name':
      return `Nice to meet you, ${name}.`;

    case 'positive_response':
      return `Great, ${name}.`;

    case 'negative_response':
      return `No problem, ${name}.`;

    case 'passive_scoring_signal':
      return `Thanks ${name}, that is really useful context.`;

    case 'signal_ready_to_book':
      return `${name}, based on what you shared, a quick Discovery Call with Rahul will give you a clear path.`;

    case 'frustration_signal':
      return `${name}, that is completely fair, and sorry this felt repetitive. Let me get a human from our team on it.`;

    case 'investor_intent':
      return `${name}, that helps — this sounds like an investor journey, so I will connect you to Salman from our recruitment team.`;

    case 'out_of_scope':
      return `${name}, that one is best answered by Rahul's team directly — I have noted it for follow-up.`;

    default:
      // FAQ / objection intents rely on the KB context only — no generic opener.
      return '';
  }
}

function wasSameQuestionLastTime(session: BotSessionDocument, question: string | null): boolean {
  if (!question) return false;
  return (session.lastQuestionAsked ?? '').trim() === question.trim();
}

export async function generateReply(params: {
  session: BotSessionDocument;
  intent: FreddyIntent;
  missingGoals: string[];
  nextQuestion: string | null;
  handlerResult: HandlerResult;
  userText: string;
}): Promise<{ text: string; guardrailFailed: boolean; questionAsked: string | null }> {
  const { session, intent, missingGoals, nextQuestion, handlerResult, userText } = params;
  const kbContext = getKbContext(intent);
  const _prompt = buildSystemPrompt(session, missingGoals, nextQuestion, handlerResult, kbContext);

  const opener = renderOpener(intent, handlerResult, session, userText);

  // Knowledge base reply is the primary content for FAQs & objections.
  const body = kbContext ?? '';

  // If the next question would be identical to the one we just asked, switch
  // tactics instead of asking it a second time in a row.
  let question: string | null = nextQuestion;
  let loopBreaker: string | null = null;
  if (wasSameQuestionLastTime(session, nextQuestion)) {
    question = null;
    loopBreaker =
      'Whenever you are ready to share that, we can move forward. In the meantime, would a short Discovery Call with Rahul help you think it through?';
  }

  // Assemble the reply, avoiding repeated fragments.
  const parts: string[] = [];
  if (opener) parts.push(opener);
  if (body && body !== opener) parts.push(body);
  if (question && missingGoals.length > 0) {
    parts.push(question);
  } else if (loopBreaker) {
    parts.push(loopBreaker);
  } else if (!body && !opener) {
    parts.push(`${firstName(session.collectedName)}, tell me a bit more and I will take it from there.`);
  } else if (!question && !body && missingGoals.length === 0) {
    // All goals met — gentle booking nudge, but no duplicate questions.
    parts.push('Want me to share the call link?');
  }

  const text = parts
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const checked = await guardrailCheck(text || `Got it, ${firstName(session.collectedName)}.`);
  return {
    text: checked.safeReply,
    guardrailFailed: checked.failed,
    questionAsked: question,
  };
}
