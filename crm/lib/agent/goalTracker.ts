import type { BotSessionDocument } from '@/models/BotSession';

export type ScoreDimension = 'capital' | 'experience' | 'location' | 'commitment' | 'timeline';
export type ScoreUpdate = Partial<Record<ScoreDimension, number>>;

const SCORE_DIMENSIONS: ScoreDimension[] = [
  'capital',
  'experience',
  'location',
  'commitment',
  'timeline',
];

function hasEvidence(session: BotSessionDocument, dimension: ScoreDimension): boolean {
  const value = session.scoringEvidence?.[dimension];
  return Boolean(value && value.trim().length > 0);
}

export function getMissingGoals(session: BotSessionDocument): string[] {
  const missing: string[] = [];
  if (!session.goalTracker?.has_name && !session.collectedName) missing.push('name');
  if (!session.goalTracker?.has_email && !session.collectedEmail) missing.push('email');
  if (!session.goalTracker?.has_phone && !session.phone) missing.push('phone');

  for (const dimension of SCORE_DIMENSIONS) {
    const trackerScore = session.goalTracker?.[`score_${dimension}` as keyof typeof session.goalTracker];
    if (trackerScore == null && !hasEvidence(session, dimension)) {
      missing.push(`score_${dimension}`);
    }
  }
  return missing;
}

const QUESTION_TEMPLATES: Record<string, string> = {
  score_capital: 'What level of capital are you comfortable allocating for expansion right now?',
  score_experience: 'How long have you been running this business?',
  score_location: 'How many operating outlets or locations do you currently run?',
  score_commitment: 'How committed are you to building a franchise model this year?',
  score_timeline: 'What timeline are you targeting to begin franchising?',
  name: 'What is the best name to use for you?',
  email: 'What is the best email for sharing next steps?',
  phone: 'What is the best number for the team to reach you quickly?',
};

export function getNextQuestion(session: BotSessionDocument, missingGoals: string[]): string | null {
  for (const goal of missingGoals) {
    if (goal.startsWith('score_')) {
      const dimension = goal.replace('score_', '') as ScoreDimension;
      if (hasEvidence(session, dimension)) continue;
    }
    return QUESTION_TEMPLATES[goal] ?? null;
  }
  return null;
}

function mapExperienceScore(years: number): number {
  if (years >= 10) return 25;
  if (years >= 7) return 20;
  if (years >= 4) return 15;
  if (years >= 2) return 10;
  return 5;
}

function mapLocationScore(outlets: number): number {
  if (outlets >= 10) return 25;
  if (outlets >= 5) return 20;
  if (outlets >= 3) return 15;
  if (outlets >= 2) return 10;
  return 5;
}

function mapCapitalScore(textLower: string): number | null {
  if (/(₹|rs\.?)\s*([4-9]\d|\d{3,})\s*lakh(s)?/.test(textLower)) return 25;
  if (/(₹|rs\.?)\s*(3\d)\s*lakh(s)?/.test(textLower)) return 20;
  if (/(₹|rs\.?)\s*(2\d)\s*lakh(s)?/.test(textLower)) return 15;
  if (/(₹|rs\.?)\s*(1\d)\s*lakh(s)?/.test(textLower)) return 10;
  if (/(₹|rs\.?)\s*\d+\s*lakh(s)?/.test(textLower)) return 5;
  if (/\bcrore\b/.test(textLower)) return 25;
  return null;
}

function mapTimelineScore(textLower: string): number | null {
  if (/(immediately|asap|right away|this month)/.test(textLower)) return 25;
  if (/(next month|1 month|2 months|3 months)/.test(textLower)) return 20;
  if (/(6 months|half year)/.test(textLower)) return 15;
  if (/(this year|12 months)/.test(textLower)) return 10;
  if (/(exploring|someday|not sure)/.test(textLower)) return 5;
  return null;
}

function mapCommitmentScore(textLower: string): number | null {
  if (/(fully committed|very serious|definitely)/.test(textLower)) return 25;
  if (/(serious|committed|ready to expand)/.test(textLower)) return 20;
  if (/(interested|thinking about it)/.test(textLower)) return 15;
  if (/(exploring|evaluating)/.test(textLower)) return 10;
  if (/(not ready|just curious)/.test(textLower)) return 5;
  return null;
}

export async function passiveScoreExtractor(messageText: string): Promise<ScoreUpdate | null> {
  const textLower = messageText.toLowerCase();
  const update: ScoreUpdate = {};

  const yearMatch = textLower.match(/(\d+)\s*(year|years)/);
  if (yearMatch) update.experience = mapExperienceScore(Number(yearMatch[1]));

  const outletsMatch = textLower.match(
    /(\d+)\s+(?:(?:[a-z]+\s+){0,2})?(outlet|outlets|store|stores|location|locations)/,
  );
  if (outletsMatch) update.location = mapLocationScore(Number(outletsMatch[1]));

  const capital = mapCapitalScore(textLower);
  if (capital != null) update.capital = capital;

  const timeline = mapTimelineScore(textLower);
  if (timeline != null) update.timeline = timeline;

  const commitment = mapCommitmentScore(textLower);
  if (commitment != null) update.commitment = commitment;

  return Object.keys(update).length > 0 ? update : null;
}

