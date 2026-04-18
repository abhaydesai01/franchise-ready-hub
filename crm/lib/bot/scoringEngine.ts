import { tierForLocationText } from './tierCities';

export type CapitalBand = 'A' | 'B' | 'C' | 'D' | 'E';
export type BusinessExperience = 'A' | 'B' | 'C' | 'D';
export type PropertyStatus = 'A' | 'B' | 'C' | 'D';
export type Motivation = 'A' | 'B' | 'C' | 'D';
export type IntentSignal = 'active' | 'mid' | 'exploring';

const CAPITAL: Record<CapitalBand, number> = {
  A: 5,
  B: 12,
  C: 18,
  D: 22,
  E: 25,
};

const EXPERIENCE: Record<BusinessExperience, number> = {
  A: 20,
  B: 15,
  C: 10,
  D: 5,
};

const PROPERTY: Record<PropertyStatus, number> = {
  A: 20,
  B: 15,
  C: 8,
  D: 2,
};

export function scoreTargetLocationTier(tier: 1 | 2 | 3): number {
  if (tier === 1) return 10;
  if (tier === 2) return 7;
  return 4;
}

export function computeFranchiseReadinessScore(input: {
  capitalBand: CapitalBand;
  businessExperience: BusinessExperience;
  targetLocationText: string;
  propertyStatus: PropertyStatus;
  motivation: Motivation;
  intentSignal: IntentSignal;
}): {
  total: number;
  readinessBand: 'franchise_ready' | 'recruitment_only' | 'not_ready';
  locationTier: 1 | 2 | 3;
  breakdown: {
    capital: number;
    experience: number;
    location: number;
    property: number;
    motivation: number;
    intent: number;
  };
} {
  const locationTier = tierForLocationText(input.targetLocationText);
  const capital = CAPITAL[input.capitalBand];
  const experience = EXPERIENCE[input.businessExperience];
  const location = scoreTargetLocationTier(locationTier);
  const property = PROPERTY[input.propertyStatus];
  const motivation = 10;
  const intent =
    input.intentSignal === 'active' ? 15 : input.intentSignal === 'mid' ? 10 : 5;

  const total = Math.min(
    100,
    capital + experience + location + property + motivation + intent,
  );

  let readinessBand: 'franchise_ready' | 'recruitment_only' | 'not_ready';
  if (total >= 75) readinessBand = 'franchise_ready';
  else if (total >= 50) readinessBand = 'recruitment_only';
  else readinessBand = 'not_ready';

  return {
    total,
    readinessBand,
    locationTier,
    breakdown: {
      capital,
      experience,
      location,
      property,
      motivation,
      intent,
    },
  };
}
