import Anthropic from '@anthropic-ai/sdk';
import type { BotSessionDocument } from '@/models/BotSession';
import type { ConversationDocument } from '@/models/Conversation';
import type { FreddyIntent } from './classifier';
import type { FlowAnswers, FlowStepId } from './flowEngine';

export type LlmAction = 'respond' | 'book_call' | 'switch_to_voice' | 'switch_to_email' | 'escalate' | 'opt_out';

export type LlmDecision = {
  /** Did the user's latest message answer the current flow step? */
  userAnsweredCurrentStep: boolean;
  /** Structured answer extracted for the current step, if any. */
  stepAnswer: Partial<FlowAnswers> | null;
  /** Did the user ask something off-flow (FAQ, objection, request)? */
  sideIntent: FreddyIntent | null;
  /** A short reply addressing the side intent. Empty string if nothing to say. */
  sideReply: string;
  /** Whole-conversation action (most commonly 'respond'). */
  action: LlmAction;
  rawJson?: string;
};

const VALID_ACTIONS = new Set<LlmAction>([
  'respond', 'book_call', 'switch_to_voice', 'switch_to_email', 'escalate', 'opt_out',
]);

const SYSTEM_PROMPT = `You are Freddy, an AI assistant for Franchise Ready India — a franchise consulting firm led by Rahul Malik.

You follow a STRUCTURED ONBOARDING FLOW: the app shows the user one question at a time (sometimes with buttons), and you only ever need to interpret the user's latest message in the context of that step.

# Voice & style
- Warm, confident, concise. Indian English.
- Maximum 35 words for any side reply. Never more than one question.
- No emojis, no markdown except *bold* for emphasis.
- Never repeat yourself. Never repeat the user's words back verbatim.

# Hard rules (never violate)
- Never quote specific prices, fees, or earnings. Defer to the Discovery Call.
- Never guarantee outcomes or speed.
- No competitor names, no false urgency, no legal advice.
- If asked if you are AI, answer honestly and briefly.

# Knowledge (for side-questions only)
- Franchise Ready is led by Rahul Malik, 20+ years in franchising.
- Investment / earnings / ROI: tailored, mapped on the Discovery Call. Never quote numbers.
- Process: free readiness assessment → system build → launch support.
- Timeline: most brands take 3–12 months to build a franchise foundation.
- Programmes: from foundational setup to full growth support.
- Team: direct work with Rahul and a specialist team, not a junior handoff.
- Contact: info@franchise-ready.in, +91 9833393077.

# Your job on every turn
1. Read the current step and the user's latest message.
2. Decide: did the user ANSWER the step, or ASK something else?
   - If they answered → extract the structured answer. Set sideReply to EMPTY STRING. The app will send its own short acknowledgement + the next step.
   - If they ASKED something substantive (FAQ / objection / request) → write a short sideReply addressing it; the app will then re-issue the step's prompt.
   - If they only said hi, ok, yes, no, hmm, or gibberish (i.e. NOT an answer, NOT a real question) → set sideReply to EMPTY STRING. Do NOT greet again. Do NOT rephrase the step. The app will just re-send the step prompt.
   - If they partially did both → extract the answer AND write a short sideReply for the aside.
3. Pick an action:
   - respond: normal (default)
   - book_call, switch_to_voice, switch_to_email: only if they explicitly request it
   - escalate: frustration, complaint, something only a human should answer
   - opt_out: user says stop

# CRITICAL — do not duplicate the step prompt
The app ALWAYS sends the current step's prompt after your reply. So sideReply must NEVER restate, rephrase, or re-ask the current step's question. It is purely for answering a side-question. If there is nothing to add, return an empty string.

# Output format (JSON only, no prose, no code fences)
{
  "userAnsweredCurrentStep": <true | false>,
  "stepAnswer": <object with ONLY the field(s) relevant to the current step, or null>,
  "sideIntent": <one of the Freddy intents, or null>,
  "sideReply": "<max 35 words, or empty string>",
  "action": "respond | book_call | switch_to_voice | switch_to_email | escalate | opt_out"
}

# Step answer shapes (only include the field for the CURRENT step)
- collect_email:        { "email": "<valid email>" }
- collect_brand:        { "brand": "<short brand name>" }
- collect_category:     { "category": "Food & Beverage" | "Retail" | "Services" | "Education" | "Health & Wellness" | "Other" }
- collect_outlets:      { "outlets": "1" | "2-4" | "5+" }
- collect_city:         { "city": "<city name>" }
- collect_service_type: { "serviceType": "full_consulting" | "recruitment_only" | "both" }
- collect_sops:         { "sopsDocumented": "yes" | "need_support" }
- collect_goal:         { "mainGoal": "one_city" | "across_india" | "international" }
- collect_timeline:     { "timeline": "this_month" | "1_3_months" | "6_months" | "exploring" }
- collect_capital:      { "capital": "lt_10" | "10_25" | "25_50" | "gt_50" }
- close_booking:        { "closeChoice": "send_link" | "call_me" | "later" }

If the user didn't actually answer the current step, set userAnsweredCurrentStep=false and stepAnswer=null.
Never invent an answer.`;

function isAnthropicConfigured(): boolean {
  return Boolean((process.env.ANTHROPIC_API_KEY ?? '').trim());
}

function buildHistory(conversation: Pick<ConversationDocument, 'messages'> | null): string {
  if (!conversation?.messages?.length) return '(no prior messages)';
  const recent = conversation.messages.slice(-10);
  return recent
    .map((m) => {
      const who = m.role === 'assistant' ? 'You' : m.role === 'user' ? 'User' : 'System';
      return `${who}: ${m.text}`;
    })
    .join('\n');
}

function stepDescription(step: FlowStepId): string {
  switch (step) {
    case 'collect_email':        return 'Ask the user for their email address.';
    case 'collect_brand':        return 'Ask the user for their brand name.';
    case 'collect_category':     return 'Ask the user for their business category (list sent with 6 options).';
    case 'collect_outlets':      return 'Ask how many operating outlets they have (buttons: 1, 2-4, 5+).';
    case 'collect_city':         return 'Ask which city they are operating from.';
    case 'collect_service_type': return 'Ask whether they want full consulting, recruitment only, or both (buttons).';
    case 'collect_sops':         return 'Ask whether their operations/costing/SOPs are documented, or they need support (buttons).';
    case 'collect_goal':         return 'Ask their main goal: one-city expansion, across India, or international (buttons).';
    case 'collect_timeline':     return 'Ask their franchising timeline (list: this month, 1-3 months, 6 months, exploring).';
    case 'collect_capital':      return 'Ask their capital range (list: <10L, 10-25L, 25-50L, 50L+).';
    case 'close_booking':        return 'All info collected. Offer a Discovery Call with Rahul (buttons: Send link / Call me / Later).';
    case 'done':                 return 'Flow already completed — freeform conversation.';
  }
}

function buildUserPrompt(params: {
  session: BotSessionDocument;
  conversation: Pick<ConversationDocument, 'messages'> | null;
  latestUserText: string;
  currentStep: FlowStepId;
  previousAssistantReply: string | null;
}): string {
  const { session, conversation, latestUserText, currentStep, previousAssistantReply } = params;
  const history = buildHistory(conversation);

  const collected: string[] = [];
  if (session.collectedName) collected.push(`name=${session.collectedName}`);
  if (session.collectedEmail) collected.push(`email=${session.collectedEmail}`);
  if (session.phone) collected.push(`phone=${session.phone}`);
  const flowAnswers = session.flowAnswers ?? {};
  const collectedJson = JSON.stringify(flowAnswers);

  return [
    `Conversation so far:`,
    history,
    ``,
    `Latest user message:`,
    `User: ${latestUserText}`,
    ``,
    `Current flow step: ${currentStep}`,
    `Step description: ${stepDescription(currentStep)}`,
    `Already collected: ${collected.join(', ') || 'none'}`,
    `Flow answers so far: ${collectedJson}`,
    previousAssistantReply
      ? `Your previous message was: "${previousAssistantReply}". Do NOT repeat it.`
      : 'This is your first message in this session.',
    ``,
    `Output ONLY the JSON decision object. Nothing else.`,
  ].join('\n');
}

function extractJson(text: string): unknown | null {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normaliseDecision(raw: unknown): LlmDecision | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const answered = r.userAnsweredCurrentStep === true;
  const action = typeof r.action === 'string' && VALID_ACTIONS.has(r.action as LlmAction)
    ? (r.action as LlmAction)
    : 'respond';
  const stepAnswer = (r.stepAnswer && typeof r.stepAnswer === 'object')
    ? (r.stepAnswer as Partial<FlowAnswers>)
    : null;
  const sideIntent = typeof r.sideIntent === 'string' ? (r.sideIntent as FreddyIntent) : null;
  const sideReply = typeof r.sideReply === 'string' ? r.sideReply.trim() : '';

  return {
    userAnsweredCurrentStep: answered,
    stepAnswer: answered ? stepAnswer : null,
    sideIntent,
    sideReply,
    action,
  };
}

export async function decideWithLlm(params: {
  session: BotSessionDocument;
  conversation: Pick<ConversationDocument, 'messages'> | null;
  latestUserText: string;
  currentStep: FlowStepId;
  previousAssistantReply: string | null;
}): Promise<LlmDecision | null> {
  if (!isAnthropicConfigured()) {
    console.warn('[freddy:llm] ANTHROPIC_API_KEY missing — falling back to deterministic brain');
    return null;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.FREDDY_LLM_MODEL || 'claude-haiku-4-5';
  const prompt = buildUserPrompt(params);

  try {
    const res = await client.messages.create(
      {
        model,
        max_tokens: 400,
        temperature: 0.2,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      },
      { timeout: 9000 },
    );
    const block = res.content[0];
    if (!block || block.type !== 'text') {
      console.warn('[freddy:llm] unexpected response block', { type: block?.type });
      return null;
    }
    const parsed = extractJson(block.text);
    if (!parsed) {
      console.warn('[freddy:llm] could not parse JSON', { sample: block.text.slice(0, 200) });
      return null;
    }
    const decision = normaliseDecision(parsed);
    if (!decision) return null;
    decision.rawJson = block.text;
    return decision;
  } catch (err) {
    console.error('[freddy:llm] call failed', err);
    return null;
  }
}

export function isLlmBrainEnabled(): boolean {
  if ((process.env.FREDDY_LLM_ENABLED ?? 'true').toLowerCase() === 'false') return false;
  return isAnthropicConfigured();
}
