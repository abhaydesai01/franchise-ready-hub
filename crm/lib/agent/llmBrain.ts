import Anthropic from '@anthropic-ai/sdk';
import type { BotSessionDocument } from '@/models/BotSession';
import type { ConversationDocument } from '@/models/Conversation';
import type { FreddyIntent } from './classifier';

export type LlmAction = 'respond' | 'book_call' | 'switch_to_voice' | 'switch_to_email' | 'escalate' | 'opt_out';

export type LlmExtracted = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  capital?: number | null;
  experience?: number | null;
  location?: number | null;
  commitment?: number | null;
  timeline?: number | null;
  isInvestor?: boolean | null;
};

export type LlmDecision = {
  intent: FreddyIntent;
  extracted: LlmExtracted;
  action: LlmAction;
  reply: string;
  rawJson?: string;
};

const VALID_INTENTS = new Set<FreddyIntent>([
  'greeting', 'positive_response', 'negative_response',
  'provide_name', 'provide_email', 'provide_phone',
  'prefer_voice', 'prefer_email', 'investor_intent',
  'passive_scoring_signal', 'signal_ready_to_book', 'high_value_signal',
  'frustration_signal',
  'faq_cost', 'faq_process', 'faq_about_fr', 'faq_timeline',
  'faq_programmes', 'faq_success', 'faq_team', 'faq_whatsapp_bot',
  'objection_not_ready', 'objection_think', 'objection_price', 'objection_not_sure',
  'confirm_booking', 'reschedule', 'opt_out', 'out_of_scope',
]);

const VALID_ACTIONS = new Set<LlmAction>([
  'respond', 'book_call', 'switch_to_voice', 'switch_to_email', 'escalate', 'opt_out',
]);

const SYSTEM_PROMPT = `You are Freddy, an AI assistant for Franchise Ready India — a franchise consulting firm led by Rahul Malik. You chat with prospective clients on WhatsApp to understand their business and, when the fit is right, line up a short Discovery Call with Rahul.

# Voice & style
- Warm, confident, concise. Indian English.
- Maximum 45 words per reply. At most one question per message.
- No bullets, no markdown, no emojis (unless the user uses them first).
- Never say generic filler like "thanks for sharing that, really helpful context." — be specific to what the user actually said.
- Do not repeat the user's words back to them. Do not repeat your previous reply.
- If your previous reply already asked question X and the user ignored it, acknowledge what they did say, then rephrase or move on — never ask the identical question twice in a row.

# Hard rules (never violate)
- Never quote or estimate specific prices, fees, franchise costs, or ROI figures — always defer that to the Discovery Call.
- Never guarantee outcomes, speed, earnings, or a specific number of franchisees.
- Never mention competitor names.
- If asked whether you are AI, answer honestly and briefly.
- No legal advice.
- No false urgency ("limited slots", "act now", "expires soon").
- No corporate jargon ("synergies", "value proposition", "ecosystem").

# Knowledge base (ground truth about Franchise Ready)
- About: Franchise Ready is led by Rahul Malik, 20+ years in franchising. Rahul has worked both as a franchisee and as a franchisor advisor, so guidance stays practical.
- Cost / investment / fees: investment is tailored to the client's business — Rahul maps it properly on the Discovery Call instead of quoting a one-size-fits-all number.
- Earnings / ROI / "how much will I earn": depends entirely on the business, model, and market — Rahul evaluates this on the Discovery Call; never quote figures.
- Process: free readiness assessment → system build → launch support. The Discovery Call is the no-risk starting point.
- Timeline: depends on how systemised the business already is. Most brands take 3–12 months to build the right franchise foundation.
- Programmes: structured tracks from foundational setup to full growth support. The right fit depends on the client's current stage.
- Success: one recent client expanded from operator-led growth into a structured franchise model with our team. The playbook is always tailored, never copy-paste.
- Team: you work directly with Rahul and a hands-on specialist team, not a junior handoff.
- Contact: info@franchise-ready.in, +91 9833393077.
- Investor route: if the user wants to BUY a franchise (not franchise their own brand), say Salman from the recruitment team is the right person and route them there.

# Information you quietly gather (never list these back to the user)
- Name, email, phone (phone is already known from WhatsApp).
- Capital band, years of business experience, number of existing outlets, commitment level, timeline to franchise.

# Actions
- respond: normal conversational reply.
- book_call: the user is clearly ready or asking what's next — offer the Discovery Call link.
- switch_to_voice: the user explicitly asks for a phone call.
- switch_to_email: the user explicitly prefers email.
- escalate: frustration, complaint, legal question, or something only a human should answer.
- opt_out: the user says stop / unsubscribe / leave me alone.

# Output format
Respond with ONLY a compact JSON object, no prose outside it, no code fences:

{
  "intent": "<one of: greeting, positive_response, negative_response, provide_name, provide_email, provide_phone, prefer_voice, prefer_email, investor_intent, passive_scoring_signal, signal_ready_to_book, frustration_signal, faq_cost, faq_process, faq_about_fr, faq_timeline, faq_programmes, faq_success, faq_team, faq_whatsapp_bot, objection_not_ready, objection_think, objection_price, objection_not_sure, confirm_booking, reschedule, opt_out, out_of_scope>",
  "extracted": {
    "name": "<string or null>",
    "email": "<string or null>",
    "phone": "<string or null>",
    "capital": "<integer 0-25 or null>",
    "experience": "<integer 0-25 or null>",
    "location": "<integer 0-25 or null>",
    "commitment": "<integer 0-25 or null>",
    "timeline": "<integer 0-25 or null>",
    "isInvestor": "<boolean or null>"
  },
  "action": "<respond | book_call | switch_to_voice | switch_to_email | escalate | opt_out>",
  "reply": "<single-paragraph WhatsApp reply. Max 45 words. At most one question.>"
}

# Scoring rubric (only set when the user's LATEST message supports it; otherwise null)
- capital: ₹<10L → 5, ₹10–19L → 10, ₹20–29L → 15, ₹30–39L → 20, ₹40L+ or any crore → 25.
- experience (years running the business): <2 → 5, 2–3 → 10, 4–6 → 15, 7–9 → 20, 10+ → 25.
- location (existing outlets): 1 → 5, 2 → 10, 3–4 → 15, 5–9 → 20, 10+ → 25.
- commitment: "fully committed/definitely/very serious" → 25; "serious/committed/ready to expand" → 20; "interested/thinking about it" → 15; "exploring/evaluating" → 10; "not ready/just curious" → 5.
- timeline: immediately/asap/this month → 25; 1–3 months → 20; ~6 months → 15; this year / 12 months → 10; exploring/unsure → 5.

Never invent data. If the user didn't provide it in their latest message, leave the field null.`;

function isAnthropicConfigured(): boolean {
  return Boolean((process.env.ANTHROPIC_API_KEY ?? '').trim());
}

function buildHistory(conversation: Pick<ConversationDocument, 'messages'> | null): string {
  if (!conversation?.messages?.length) return '(no prior messages)';
  const recent = conversation.messages.slice(-12);
  return recent
    .map((m) => {
      const who = m.role === 'assistant' ? 'You' : m.role === 'user' ? 'User' : 'System';
      return `${who}: ${m.text}`;
    })
    .join('\n');
}

function buildUserPrompt(params: {
  session: BotSessionDocument;
  conversation: Pick<ConversationDocument, 'messages'> | null;
  latestUserText: string;
  missingGoals: string[];
  suggestedNextQuestion: string | null;
  previousAssistantReply: string | null;
}): string {
  const { session, conversation, latestUserText, missingGoals, suggestedNextQuestion, previousAssistantReply } = params;
  const history = buildHistory(conversation);

  const collected: string[] = [];
  if (session.collectedName) collected.push(`name=${session.collectedName}`);
  if (session.collectedEmail) collected.push(`email=${session.collectedEmail}`);
  if (session.phone) collected.push(`phone=${session.phone}`);
  const scoringEvidence = session.scoringEvidence ?? {};
  const gt = session.goalTracker ?? {};
  const scoreSummary = (['capital', 'experience', 'location', 'commitment', 'timeline'] as const)
    .map((dim) => {
      const val = (gt as Record<string, unknown>)[`score_${dim}`];
      return val != null ? `${dim}=${val}` : null;
    })
    .filter(Boolean)
    .join(', ');

  return [
    `Conversation so far:`,
    history,
    ``,
    `Latest user message:`,
    `User: ${latestUserText}`,
    ``,
    `Session state:`,
    `- Collected: ${collected.length ? collected.join(', ') : 'none'}`,
    `- Scores so far: ${scoreSummary || 'none'}`,
    `- Scoring evidence: ${JSON.stringify(scoringEvidence)}`,
    `- Missing information: ${missingGoals.length ? missingGoals.join(', ') : 'none — all captured'}`,
    suggestedNextQuestion
      ? `- Natural next topic to work toward (you may rephrase or skip if the user asked something else): "${suggestedNextQuestion}"`
      : `- All key information captured. Guide warmly toward booking the Discovery Call.`,
    previousAssistantReply
      ? `- Your previous reply was: "${previousAssistantReply}". Do NOT repeat that verbatim.`
      : `- This is your first reply in this session.`,
    ``,
    `Respond to the user's latest message now. Output ONLY the JSON object, nothing else.`,
  ].join('\n');
}

function extractJson(text: string): unknown | null {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // try to find the first {...} block
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

function clampScore(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 0) return 0;
  if (rounded > 25) return 25;
  return rounded;
}

function normaliseDecision(raw: unknown): LlmDecision | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const intent = typeof r.intent === 'string' && VALID_INTENTS.has(r.intent as FreddyIntent)
    ? (r.intent as FreddyIntent)
    : 'out_of_scope';
  const action = typeof r.action === 'string' && VALID_ACTIONS.has(r.action as LlmAction)
    ? (r.action as LlmAction)
    : 'respond';
  const reply = typeof r.reply === 'string' ? r.reply.trim() : '';
  if (!reply) return null;

  const extractedRaw = (r.extracted && typeof r.extracted === 'object')
    ? (r.extracted as Record<string, unknown>)
    : {};
  const extracted: LlmExtracted = {
    name: typeof extractedRaw.name === 'string' && extractedRaw.name.trim() ? extractedRaw.name.trim() : null,
    email: typeof extractedRaw.email === 'string' && extractedRaw.email.trim() ? extractedRaw.email.trim().toLowerCase() : null,
    phone: typeof extractedRaw.phone === 'string' && extractedRaw.phone.trim() ? extractedRaw.phone.trim() : null,
    capital: clampScore(extractedRaw.capital),
    experience: clampScore(extractedRaw.experience),
    location: clampScore(extractedRaw.location),
    commitment: clampScore(extractedRaw.commitment),
    timeline: clampScore(extractedRaw.timeline),
    isInvestor: typeof extractedRaw.isInvestor === 'boolean' ? extractedRaw.isInvestor : null,
  };

  return { intent, extracted, action, reply };
}

export async function decideWithLlm(params: {
  session: BotSessionDocument;
  conversation: Pick<ConversationDocument, 'messages'> | null;
  latestUserText: string;
  missingGoals: string[];
  suggestedNextQuestion: string | null;
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
        max_tokens: 600,
        temperature: 0.3,
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
      console.warn('[freddy:llm] could not parse JSON from model output', { sample: block.text.slice(0, 200) });
      return null;
    }
    const decision = normaliseDecision(parsed);
    if (!decision) {
      console.warn('[freddy:llm] normalised decision was empty');
      return null;
    }
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
