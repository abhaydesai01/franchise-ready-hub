/**
 * Infers a normalized outcome and slot from Vaani summary/entities
 * (same heuristics as the webhook post-processing path).
 */
export type VoiceInferredOutcome =
  | 'booked'
  | 'callback_requested'
  | 'not_interested'
  | 'no_answer'
  | 'failed'
  | 'inconclusive';

export function inferVoiceOutcome(
  summary: string,
  entities: Record<string, unknown>,
): VoiceInferredOutcome {
  const s = (summary || '').toLowerCase();
  if (
    s.includes('booked') ||
    s.includes('confirmed') ||
    s.includes('agreed to') ||
    /option\s*[123]/.test(s)
  ) {
    return 'booked';
  }
  if (
    s.includes('call back') ||
    s.includes('callback') ||
    s.includes('busy') ||
    s.includes('later') ||
    s.includes('next quarter') ||
    s.includes('reconnect') ||
    s.includes('follow up') ||
    s.includes('follow-up') ||
    s.includes('following up') ||
    s.includes('check in') ||
    s.includes('check-in') ||
    s.includes('reach out again') ||
    s.includes('touch base')
  ) {
    return 'callback_requested';
  }
  if (
    s.includes('not interested') ||
    s.includes('no interest') ||
    s.includes('declined') ||
    s.includes('do not want') ||
    s.includes("don't want") ||
    s.includes('stop calling') ||
    s.includes('not interested in')
  ) {
    return 'not_interested';
  }
  if (s.includes('no answer') || s.includes('did not pick')) {
    return 'no_answer';
  }
  if (s.includes('failed') || s.includes('error')) {
    return 'failed';
  }
  return 'inconclusive';
}

export function extractSlotIndex(
  entities: Record<string, unknown>,
  summary: string,
): number | null {
  const sc = entities.slot_choice ?? entities.option_selected;
  if (sc != null) {
    const n = parseInt(String(sc), 10);
    if (n >= 1 && n <= 3) return n;
  }
  const m = (summary || '').match(/option\s*(\d)/i);
  if (m) return parseInt(m[1], 10);
  return null;
}
