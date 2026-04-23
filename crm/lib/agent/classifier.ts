export type FreddyIntent =
  | 'greeting'
  | 'positive_response'
  | 'negative_response'
  | 'provide_name'
  | 'provide_email'
  | 'provide_phone'
  | 'prefer_voice'
  | 'prefer_email'
  | 'investor_intent'
  | 'passive_scoring_signal'
  | 'signal_ready_to_book'
  | 'high_value_signal'
  | 'frustration_signal'
  | 'faq_cost'
  | 'faq_process'
  | 'faq_about_fr'
  | 'faq_timeline'
  | 'faq_programmes'
  | 'faq_success'
  | 'faq_team'
  | 'faq_whatsapp_bot'
  | 'objection_not_ready'
  | 'objection_think'
  | 'objection_price'
  | 'objection_not_sure'
  | 'confirm_booking'
  | 'reschedule'
  | 'opt_out'
  | 'out_of_scope';

const EMAIL_RE = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const PHONE_RE = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary match. Prevents e.g. "ai" matching inside "desai" or "gmail".
function hasWord(text: string, terms: string[]): boolean {
  const re = new RegExp(`\\b(?:${terms.map(escapeRegex).join('|')})\\b`, 'i');
  return re.test(text);
}

// Free-form phrase match (substrings allowed for multi-word expressions).
function hasPhrase(text: string, phrases: string[]): boolean {
  return phrases.some((p) => text.includes(p));
}

export function classifyIntent(messageText: string): FreddyIntent {
  const text = messageText.trim();
  const t = text.toLowerCase();

  // 1. High-confidence structured patterns first — email / phone cannot be
  //    misclassified by ambiguous keywords.
  if (EMAIL_RE.test(text)) return 'provide_email';
  if (PHONE_RE.test(text)) return 'provide_phone';

  // 2. Pure short greetings / yes / no — handled before any keyword search so
  //    "Hello" is never classified as a name or FAQ.
  if (/^(hi|hello|hey|heya|hii+|hiya|hai|helo|hlw|hola)[!.?\s]*$/i.test(text)) return 'greeting';
  if (/^(yes|yeah|yep|yup|sure|okay|ok|great|sounds good|alright)[!.?\s]*$/i.test(text)) return 'positive_response';
  if (/^(no|nope|nah|not now|not interested)[!.?\s]*$/i.test(text)) return 'negative_response';

  // 3. Opt-out / reschedule / confirm booking.
  if (hasWord(t, ['stop', 'unsubscribe']) || hasPhrase(t, ['opt out', 'opt-out'])) return 'opt_out';
  if (hasWord(t, ['reschedule']) || hasPhrase(t, ['another time'])) return 'reschedule';
  if (hasWord(t, ['booked', 'scheduled']) || hasPhrase(t, ['done booking'])) return 'confirm_booking';

  // 4. Channel preference.
  if (
    hasPhrase(t, [
      'call me',
      'can we talk',
      'i prefer speaking',
      'phone call',
      'voice call',
      'rather speak',
      'just call',
      'give me a call',
      'ring me',
      'can someone call',
    ])
  ) {
    return 'prefer_voice';
  }
  if (hasPhrase(t, ['email me', 'prefer email', 'send over email', 'by email'])) return 'prefer_email';

  // 5. Intent signals.
  if (hasWord(t, ['investor', 'investors']) || hasPhrase(t, ['buy a franchise', 'franchise partner'])) {
    return 'investor_intent';
  }
  if (hasWord(t, ['frustrated', 'annoyed']) || hasPhrase(t, ['you keep asking', 'this is useless'])) {
    return 'frustration_signal';
  }
  if (
    hasPhrase(t, [
      'what next',
      'get started',
      'getting started',
      'how do i proceed',
      'sounds great',
      'who do i speak to',
    ])
  ) {
    return 'signal_ready_to_book';
  }

  // 6. FAQs — word-boundary ONLY so "cost" never matches "costly" and "ai"
  //    never matches inside names/emails.
  if (hasWord(t, ['cost', 'costs', 'price', 'pricing', 'fee', 'fees', 'investment'])) return 'faq_cost';
  if (hasWord(t, ['process', 'steps']) || hasPhrase(t, ['how it works'])) return 'faq_process';
  if (hasPhrase(t, ['about franchise ready', 'who is rahul', 'about you'])) return 'faq_about_fr';
  if (hasWord(t, ['timeline', 'months']) || hasPhrase(t, ['how long'])) return 'faq_timeline';
  if (hasWord(t, ['program', 'programs', 'programme', 'programmes', 'plans'])) return 'faq_programmes';
  if (hasWord(t, ['success', 'results']) || hasPhrase(t, ['case study'])) return 'faq_success';
  if (hasWord(t, ['team']) || hasPhrase(t, ['who will work'])) return 'faq_team';
  if (hasWord(t, ['bot', 'ai', 'robot', 'chatbot'])) return 'faq_whatsapp_bot';

  // 7. Objections.
  if (hasPhrase(t, ['not ready'])) return 'objection_not_ready';
  if (hasPhrase(t, ['need to think', 'let me think'])) return 'objection_think';
  if (hasPhrase(t, ['too expensive', 'price is high'])) return 'objection_price';
  if (hasPhrase(t, ['not sure']) || hasWord(t, ['unsure'])) return 'objection_not_sure';

  // 8. Embedded greeting (e.g. "hi there").
  if (hasWord(t, ['hi', 'hello', 'hey'])) return 'greeting';

  // 9. Passive scoring signals (numbers of years, outlets, capital, etc.).
  if (looksLikePassiveScoringSignal(t)) return 'passive_scoring_signal';

  // 10. Name — only if it really looks like a name (2-4 words, no sentence
  //     indicators, not a greeting).
  if (isPlausibleName(text)) return 'provide_name';

  // 11. Loose yes/no as fallback.
  if (hasWord(t, ['yes', 'sure', 'okay', 'great'])) return 'positive_response';
  if (hasWord(t, ['no'])) return 'negative_response';

  return 'out_of_scope';
}

const COMMON_NON_NAME_WORDS = new Set([
  'hi', 'hello', 'hey', 'heya', 'hii', 'hiya', 'hai', 'helo', 'hlw', 'hola',
  'yes', 'yeah', 'yep', 'yup', 'sure', 'okay', 'ok', 'great', 'alright',
  'no', 'nope', 'nah', 'not',
  'thanks', 'thank', 'thx', 'ty',
  'cool', 'nice', 'good', 'fine', 'bad',
  'test', 'testing',
  'bye', 'goodbye',
]);

// Words that almost never appear in a human name. If any are present, the text
// is a sentence (e.g. "I am interested", "tell me more"), not a name.
const SENTENCE_INDICATORS = new Set([
  'i', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'the', 'a', 'an',
  'my', 'your', 'our', 'their', 'his', 'her',
  'me', 'you', 'we', 'they', 'us', 'them', 'him', 'it',
  'what', 'why', 'how', 'when', 'where', 'who', 'which',
  'do', 'does', 'did', 'have', 'has', 'had',
  'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must',
  'tell', 'show', 'send', 'give', 'want', 'need',
  'of', 'for', 'to', 'in', 'on', 'at', 'with', 'from', 'about',
  'and', 'or', 'but',
  'interested', 'interest', 'ready', 'looking', 'thinking',
]);

function isPlausibleName(text: string): boolean {
  const trimmed = text.trim();
  if (!/^[a-z][a-z\s.'-]{1,50}$/i.test(trimmed)) return false;
  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 1) return false;
  if (words.length > 4) return false;
  if (words.some((w) => SENTENCE_INDICATORS.has(w))) return false;
  return !words.every((w) => COMMON_NON_NAME_WORDS.has(w));
}

export function looksLikePassiveScoringSignal(textLower: string): boolean {
  return (
    /\b(\d+)\s*(year|years)\b/.test(textLower) ||
    /\b(\d+)\s*(outlet|outlets|store|stores|location|locations)\b/.test(textLower) ||
    /(₹|rs\.?|lakh(s)?|crore)/.test(textLower) ||
    hasPhrase(textLower, ['ready to expand', 'want to franchise', 'immediately', 'next month'])
  );
}
