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

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t));
}

export function classifyIntent(messageText: string): FreddyIntent {
  const text = messageText.trim();
  const t = text.toLowerCase();

  if (hasAny(t, ['stop', 'unsubscribe', 'opt out'])) return 'opt_out';
  if (hasAny(t, ['reschedule', 'another time'])) return 'reschedule';
  if (hasAny(t, ['booked', 'done booking', 'scheduled'])) return 'confirm_booking';

  if (
    hasAny(t, [
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
  if (hasAny(t, ['email me', 'prefer email', 'send over email', 'by email'])) return 'prefer_email';
  if (hasAny(t, ['investor', 'buy a franchise', 'franchise partner'])) return 'investor_intent';
  if (hasAny(t, ['frustrated', 'annoyed', 'you keep asking', 'this is useless'])) return 'frustration_signal';
  if (
    hasAny(t, [
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

  if (hasAny(t, ['cost', 'price', 'fees', 'investment'])) return 'faq_cost';
  if (hasAny(t, ['process', 'how it works', 'steps'])) return 'faq_process';
  if (hasAny(t, ['about franchise ready', 'who is rahul', 'about you'])) return 'faq_about_fr';
  if (hasAny(t, ['timeline', 'how long', 'months'])) return 'faq_timeline';
  if (hasAny(t, ['program', 'programme', 'plans'])) return 'faq_programmes';
  if (hasAny(t, ['success', 'case study', 'results'])) return 'faq_success';
  if (hasAny(t, ['team', 'who will work'])) return 'faq_team';
  if (hasAny(t, ['bot', 'ai', 'robot'])) return 'faq_whatsapp_bot';

  if (hasAny(t, ['not ready'])) return 'objection_not_ready';
  if (hasAny(t, ['need to think', 'let me think'])) return 'objection_think';
  if (hasAny(t, ['too expensive', 'price is high'])) return 'objection_price';
  if (hasAny(t, ['not sure', 'unsure'])) return 'objection_not_sure';

  if (EMAIL_RE.test(text)) return 'provide_email';
  if (PHONE_RE.test(text)) return 'provide_phone';
  if (/^[a-z][a-z\s.'-]{1,50}$/i.test(text)) return 'provide_name';

  if (/\b(hi|hello|hey)\b/.test(t)) return 'greeting';
  if (/\b(yes|sure|okay|great)\b/.test(t)) return 'positive_response';
  if (/\b(no|not now)\b/.test(t)) return 'negative_response';

  if (looksLikePassiveScoringSignal(t)) return 'passive_scoring_signal';
  return 'out_of_scope';
}

export function looksLikePassiveScoringSignal(textLower: string): boolean {
  return (
    /\b(\d+)\s*(year|years)\b/.test(textLower) ||
    /\b(\d+)\s*(outlet|outlets|store|stores|location|locations)\b/.test(textLower) ||
    /(₹|rs\.?|lakh(s)?|crore)/.test(textLower) ||
    hasAny(textLower, ['ready to expand', 'want to franchise', 'immediately', 'next month'])
  );
}

