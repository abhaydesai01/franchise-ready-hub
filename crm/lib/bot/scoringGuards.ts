const SCORE_CAP_KEYS = new Set(['cap_1', 'cap_2', 'cap_3', 'cap_4', 'cap_5']);
const SCORE_EXP_KEYS = new Set(['exp_1', 'exp_2', 'exp_3', 'exp_4', 'exp_5']);
const SCORE_LOC_KEYS = new Set(['loc_1', 'loc_2', 'loc_5']);
const SCORE_COM_KEYS = new Set(['com_1', 'com_2', 'com_3']);
const SCORE_TIME_KEYS = new Set(['time_1', 'time_2', 'time_3', 'time_4']);

export const SCORING_STATES = [
  'SCORING_Q1',
  'SCORING_Q2',
  'SCORING_Q3',
  'SCORING_Q4',
  'SCORING_Q5',
] as const;

export type ScoringState = (typeof SCORING_STATES)[number];

export type ScoringInboundInput = {
  type: string;
  text?: string;
  buttonId?: string;
  buttonTitle?: string;
  listReplyId?: string;
};

export function isScoringState(state: string): state is ScoringState {
  return (SCORING_STATES as readonly string[]).includes(state);
}

function replyId(input: ScoringInboundInput): string {
  return (input.listReplyId ?? input.buttonId ?? (input.text ?? '').trim()).trim();
}

/** True when the inbound payload maps to a known scoring option for this step. */
export function isValidScoringReply(state: ScoringState, input: ScoringInboundInput): boolean {
  const rid = replyId(input);
  if (!rid) return false;
  switch (state) {
    case 'SCORING_Q1':
      return SCORE_CAP_KEYS.has(rid);
    case 'SCORING_Q2':
      return SCORE_EXP_KEYS.has(rid);
    case 'SCORING_Q3':
      return SCORE_LOC_KEYS.has(rid);
    case 'SCORING_Q4':
      return SCORE_COM_KEYS.has(rid);
    case 'SCORING_Q5':
      return SCORE_TIME_KEYS.has(rid);
    default:
      return false;
  }
}
