import type { GapArea } from './scorecard.types';

/** Map scoreDimensions.name → numeric score */
function scoreFor(
  dimensions: Array<{ name: string; score: number }>,
  matchers: RegExp[],
): number {
  const d = dimensions.find((x) =>
    matchers.some((re) => re.test(x.name ?? '')),
  );
  return d?.score ?? 0;
}

/**
 * Gap rules from spec (dimension scores vs thresholds).
 */
export function computeGapAreas(
  dimensions: Array<{ name: string; score: number; max: number }>,
): GapArea[] {
  const gaps: GapArea[] = [];
  const capital = scoreFor(dimensions, [/capital/i]);
  const experience = scoreFor(dimensions, [/experience/i]);
  const property = scoreFor(dimensions, [/property/i]);
  const intent = scoreFor(dimensions, [/intent/i]);

  if (capital < 12) {
    gaps.push({
      title: 'Capital readiness',
      description:
        'you may need to explore financing options before committing.',
    });
  }
  if (experience < 10) {
    gaps.push({
      title: 'Business experience',
      description: 'our onboarding programme will cover the fundamentals.',
    });
  }
  if (property < 8) {
    gaps.push({
      title: 'Location planning',
      description:
        "let's identify the right market in your discovery call.",
    });
  }
  if (intent < 10) {
    gaps.push({
      title: 'Timeline',
      description:
        'no rush, our consultant will help you build a clear roadmap.',
    });
  }

  return gaps;
}

export function readinessSummaryTemplate(band: string): string {
  switch (band) {
    case 'franchise_ready':
      return (
        'Your responses indicate strong alignment with franchise ownership readiness across capital, experience, and intent. ' +
        'You are in a solid position to move forward with a structured discovery conversation and personalised next steps.'
      );
    case 'recruitment_only':
      return (
        'Your profile shows clear strengths alongside a few areas that may benefit from preparation or education before commitment. ' +
        'Many successful franchisees started here — our team will help you strengthen gaps and decide the right path.'
      );
    default:
      return (
        'Your current inputs suggest more exploration or preparation may be helpful before committing to a franchise investment. ' +
        'This is a common stage — we can help you build clarity, confidence, and a practical roadmap from where you are today.'
      );
  }
}
