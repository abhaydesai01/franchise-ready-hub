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

function renderBaseReply(intent: FreddyIntent, kbContext: string | null, name?: string | null): string {
  const displayName = name?.trim() || 'there';
  switch (intent) {
    case 'signal_ready_to_book':
      return `${displayName}, based on what you shared, a quick Discovery Call with Rahul will give you a clear path. Want the booking link?`;
    case 'frustration_signal':
      return `${displayName}, that is completely fair, and sorry this felt repetitive. Would a direct human callback help right away?`;
    case 'investor_intent':
      return `${displayName}, that helps — this sounds like an investor journey, so I will connect you to Salman from our recruitment team.`;
    case 'out_of_scope':
      return (
        kbContext ??
        `${displayName}, that question is best answered by Rahul's team directly, and I have noted it for follow-up.`
      );
    default:
      return kbContext ?? `${displayName}, thanks for sharing that, really helpful context.`;
  }
}

export async function generateReply(params: {
  session: BotSessionDocument;
  intent: FreddyIntent;
  missingGoals: string[];
  nextQuestion: string | null;
  handlerResult: HandlerResult;
}): Promise<{ text: string; guardrailFailed: boolean }> {
  const { session, intent, missingGoals, nextQuestion, handlerResult } = params;
  const kbContext = getKbContext(intent);
  const _prompt = buildSystemPrompt(session, missingGoals, nextQuestion, handlerResult, kbContext);
  const base = renderBaseReply(intent, kbContext, session.collectedName);
  const withQuestion =
    nextQuestion && missingGoals.length > 0 ? `${base} ${nextQuestion}` : `${base} Want me to share the call link?`;
  const checked = await guardrailCheck(withQuestion);
  return { text: checked.safeReply, guardrailFailed: checked.failed };
}

