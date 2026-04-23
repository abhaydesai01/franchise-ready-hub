import type { BotSessionDocument } from '@/models/BotSession';

export type FlowStepId =
  | 'collect_email'
  | 'collect_brand'
  | 'collect_category'
  | 'collect_outlets'
  | 'collect_city'
  | 'collect_service_type'
  | 'collect_sops'
  | 'collect_goal'
  | 'collect_timeline'
  | 'collect_capital'
  | 'close_booking'
  | 'done';

export type Prompt =
  | { type: 'text'; text: string }
  | {
      type: 'buttons';
      body: string;
      buttons: { id: string; title: string }[];
    }
  | {
      type: 'list';
      body: string;
      buttonLabel: string;
      sections: {
        title: string;
        rows: { id: string; title: string; description?: string }[];
      }[];
    };

export type FlowAnswers = {
  email?: string;
  brand?: string;
  category?: string;
  outlets?: '1' | '2-4' | '5+';
  city?: string;
  serviceType?: 'full_consulting' | 'recruitment_only' | 'both';
  sopsDocumented?: 'yes' | 'need_support';
  mainGoal?: 'one_city' | 'across_india' | 'international';
  timeline?: 'this_month' | '1_3_months' | '6_months' | 'exploring';
  capital?: 'lt_10' | '10_25' | '25_50' | '50_100' | 'gt_100';
  closeChoice?: 'send_link' | 'call_me' | 'later';
};

function fName(session: BotSessionDocument): string {
  const n = (session.collectedName ?? '').trim();
  if (!n) return 'there';
  return n.split(/\s+/)[0];
}

function answers(session: BotSessionDocument): FlowAnswers {
  return (session.flowAnswers ?? {}) as FlowAnswers;
}

function isStepComplete(session: BotSessionDocument, step: FlowStepId): boolean {
  const a = answers(session);
  switch (step) {
    case 'collect_email':
      return Boolean(session.collectedEmail || a.email);
    case 'collect_brand':
      return Boolean(a.brand);
    case 'collect_category':
      return Boolean(a.category);
    case 'collect_outlets':
      return Boolean(a.outlets);
    case 'collect_city':
      return Boolean(a.city);
    case 'collect_service_type':
      return Boolean(a.serviceType);
    case 'collect_sops':
      return Boolean(a.sopsDocumented);
    case 'collect_goal':
      return Boolean(a.mainGoal);
    case 'collect_timeline':
      return Boolean(a.timeline);
    case 'collect_capital':
      return Boolean(a.capital);
    case 'close_booking':
      return Boolean(a.closeChoice);
    default:
      return true;
  }
}

const STEP_ORDER: FlowStepId[] = [
  'collect_email',
  'collect_brand',
  'collect_category',
  'collect_outlets',
  'collect_city',
  'collect_service_type',
  'collect_sops',
  'collect_goal',
  'collect_timeline',
  'collect_capital',
  'close_booking',
];

export function getCurrentStep(session: BotSessionDocument): FlowStepId {
  if (session.flowCompletedAt) return 'done';
  for (const step of STEP_ORDER) {
    if (!isStepComplete(session, step)) return step;
  }
  return 'done';
}

export function nextStepAfter(step: FlowStepId): FlowStepId {
  const idx = STEP_ORDER.indexOf(step);
  if (idx === -1 || idx >= STEP_ORDER.length - 1) return 'done';
  return STEP_ORDER[idx + 1];
}

// Human-friendly labels for the recap in the close step.
export function labelFor(key: keyof FlowAnswers, value: string): string {
  switch (key) {
    case 'outlets':
      return value === '1' ? '1 outlet' : value === '2-4' ? '2–4 outlets' : '5+ outlets';
    case 'serviceType':
      return value === 'full_consulting'
        ? 'build the full franchise system'
        : value === 'recruitment_only'
          ? 'find qualified franchisees'
          : 'both build + recruit';
    case 'sopsDocumented':
      return value === 'yes' ? 'systems documented' : 'need support building systems';
    case 'mainGoal':
      return value === 'one_city'
        ? 'one-city expansion'
        : value === 'across_india'
          ? 'across India'
          : 'international growth';
    case 'timeline':
      return value === 'this_month'
        ? 'starting this month'
        : value === '1_3_months'
          ? 'next 1–3 months'
          : value === '6_months'
            ? 'within 6 months'
            : 'exploring timelines';
    case 'capital':
      return value === 'lt_10'
        ? 'under ₹10L'
        : value === '10_25'
          ? '₹10L–₹25L'
          : value === '25_50'
            ? '₹25L–₹50L'
            : value === '50_100'
              ? '₹50L–₹1Cr'
              : '₹1Cr+';
    default:
      return value;
  }
}

function stepNumber(step: FlowStepId): number {
  return STEP_ORDER.indexOf(step) + 1;
}

export function renderPrompt(step: FlowStepId, session: BotSessionDocument): Prompt | null {
  const name = fName(session);
  const a = answers(session);
  const total = STEP_ORDER.length - 1; // exclude close_booking from the "N of M" count
  const n = stepNumber(step);

  switch (step) {
    case 'collect_email':
      return {
        type: 'text',
        text:
          `Hi ${name}! I'm *Freddy* from Franchise Ready. I'll ask a few quick questions to understand your brand and match you with the right expert.\n\n` +
          `To begin — what's the best *email* to share next steps on?`,
      };

    case 'collect_brand':
      return {
        type: 'text',
        text: `Thanks ${name}. What's the *brand name* you're looking to franchise?`,
      };

    case 'collect_category':
      return {
        type: 'list',
        body: `Which *category* does ${a.brand ?? 'your brand'} belong to?`,
        buttonLabel: 'Choose category',
        sections: [
          {
            title: 'Categories',
            rows: [
              { id: 'cat_food', title: 'Food & Beverage', description: 'Restaurants, cafés, QSR, cloud kitchen' },
              { id: 'cat_retail', title: 'Retail', description: 'Apparel, grocery, lifestyle, specialty' },
              { id: 'cat_services', title: 'Services', description: 'Salon, repair, home services' },
              { id: 'cat_education', title: 'Education', description: 'Coaching, preschool, skills' },
              { id: 'cat_wellness', title: 'Health & Wellness', description: 'Fitness, clinics, spa' },
              { id: 'cat_other', title: 'Other', description: 'Something else — tell me more' },
            ],
          },
        ],
      };

    case 'collect_outlets':
      return {
        type: 'buttons',
        body: `How many *operational outlets* of ${a.brand ?? 'your brand'} are running today?`,
        buttons: [
          { id: 'outlets_1', title: 'Just 1' },
          { id: 'outlets_2_4', title: '2 to 4' },
          { id: 'outlets_5_plus', title: '5 or more' },
        ],
      };

    case 'collect_city':
      return {
        type: 'text',
        text: `Which *city* are you operating from right now?`,
      };

    case 'collect_service_type':
      return {
        type: 'buttons',
        body:
          `Two ways we usually help:\n` +
          `• *Build the system* — documentation, pricing, franchise kit\n` +
          `• *Find franchisees* — qualified investor outreach\n\n` +
          `Which fits you best?`,
        buttons: [
          { id: 'svc_full', title: 'Build the system' },
          { id: 'svc_recruit', title: 'Find franchisees' },
          { id: 'svc_both', title: 'Both' },
        ],
      };

    case 'collect_sops':
      return {
        type: 'buttons',
        body: `Are your *operations, pricing, and SOPs* already documented, or would you want support in building those?`,
        buttons: [
          { id: 'sops_yes', title: 'Already ready' },
          { id: 'sops_need', title: 'Need support' },
        ],
      };

    case 'collect_goal':
      return {
        type: 'buttons',
        body: `Where do you want ${a.brand ?? 'the brand'} to grow?`,
        buttons: [
          { id: 'goal_city', title: 'One city' },
          { id: 'goal_india', title: 'Across India' },
          { id: 'goal_intl', title: 'International' },
        ],
      };

    case 'collect_timeline':
      return {
        type: 'list',
        body: `When would you want to *start franchising*?`,
        buttonLabel: 'Pick timeline',
        sections: [
          {
            title: 'Timeline',
            rows: [
              { id: 'tl_month', title: 'This month', description: 'Ready to start right away' },
              { id: 'tl_1_3', title: '1 to 3 months', description: 'Planning for the next quarter' },
              { id: 'tl_6', title: 'About 6 months', description: 'Building readiness first' },
              { id: 'tl_explore', title: 'Just exploring', description: 'No firm date yet' },
            ],
          },
        ],
      };

    case 'collect_capital':
      return {
        type: 'list',
        body:
          `Last one — this helps us match you to the right programme. ` +
          `Roughly, what *investment range* are you comfortable allocating for franchising?`,
        buttonLabel: 'Pick range',
        sections: [
          {
            title: 'Investment range',
            rows: [
              { id: 'cap_lt10', title: 'Under ₹10L' },
              { id: 'cap_10_25', title: '₹10L – ₹25L' },
              { id: 'cap_25_50', title: '₹25L – ₹50L' },
              { id: 'cap_50_100', title: '₹50L – ₹1Cr' },
              { id: 'cap_gt100', title: '₹1Cr or more' },
            ],
          },
        ],
      };

    case 'close_booking': {
      const recapLines: string[] = [];
      if (a.brand) {
        const cat = a.category ? ` (${a.category})` : '';
        recapLines.push(`• ${a.brand}${cat}`);
      }
      const running: string[] = [];
      if (a.outlets) running.push(labelFor('outlets', a.outlets));
      if (a.city) running.push(`in ${a.city}`);
      if (running.length) recapLines.push(`• ${running.join(' ')} today`);
      if (a.serviceType) recapLines.push(`• Looking to ${labelFor('serviceType', a.serviceType)}`);
      if (a.mainGoal) recapLines.push(`• Goal: ${labelFor('mainGoal', a.mainGoal)}`);
      if (a.timeline) recapLines.push(`• Timeline: ${labelFor('timeline', a.timeline)}`);
      if (a.capital) recapLines.push(`• Investment range: ${labelFor('capital', a.capital)}`);

      const recap = recapLines.length ? `\n\nHere's what I've got:\n${recapLines.join('\n')}\n` : '\n\n';

      return {
        type: 'buttons',
        body:
          `Thank you, ${name}.${recap}\n` +
          `Based on this, the best next step is a *20-minute Discovery Call* with *Rahul Malik* — he'll walk you through exactly how we'd approach your case.`,
        buttons: [
          { id: 'close_link', title: 'Book the call' },
          { id: 'close_call', title: 'Call me now' },
          { id: 'close_later', title: 'Maybe later' },
        ],
      };
    }

    case 'done':
      return null;

    default:
      return null;
  }
  // (n / total are available for progress hints if you later want them; kept to avoid unused-var warnings)
  void n;
  void total;
}

export function parseButtonReply(step: FlowStepId, id: string): Partial<FlowAnswers> | null {
  const map: Record<string, Partial<FlowAnswers>> = {
    cat_food: { category: 'Food & Beverage' },
    cat_retail: { category: 'Retail' },
    cat_services: { category: 'Services' },
    cat_education: { category: 'Education' },
    cat_wellness: { category: 'Health & Wellness' },
    cat_other: { category: 'Other' },

    outlets_1: { outlets: '1' },
    outlets_2_4: { outlets: '2-4' },
    outlets_5_plus: { outlets: '5+' },

    svc_full: { serviceType: 'full_consulting' },
    svc_recruit: { serviceType: 'recruitment_only' },
    svc_both: { serviceType: 'both' },

    sops_yes: { sopsDocumented: 'yes' },
    sops_need: { sopsDocumented: 'need_support' },

    goal_city: { mainGoal: 'one_city' },
    goal_india: { mainGoal: 'across_india' },
    goal_intl: { mainGoal: 'international' },

    tl_month: { timeline: 'this_month' },
    tl_1_3: { timeline: '1_3_months' },
    tl_6: { timeline: '6_months' },
    tl_explore: { timeline: 'exploring' },

    cap_lt10: { capital: 'lt_10' },
    cap_10_25: { capital: '10_25' },
    cap_25_50: { capital: '25_50' },
    cap_50_100: { capital: '50_100' },
    cap_gt100: { capital: 'gt_100' },

    close_link: { closeChoice: 'send_link' },
    close_call: { closeChoice: 'call_me' },
    close_later: { closeChoice: 'later' },
  };
  const v = map[id];
  if (!v) return null;
  if (step === 'collect_category' && v.category) return v;
  if (step === 'collect_outlets' && v.outlets) return v;
  if (step === 'collect_service_type' && v.serviceType) return v;
  if (step === 'collect_sops' && v.sopsDocumented) return v;
  if (step === 'collect_goal' && v.mainGoal) return v;
  if (step === 'collect_timeline' && v.timeline) return v;
  if (step === 'collect_capital' && v.capital) return v;
  if (step === 'close_booking' && v.closeChoice) return v;
  return null;
}

export function parseTextForStep(step: FlowStepId, text: string): Partial<FlowAnswers> | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;
  switch (step) {
    case 'collect_email': {
      const m = text.match(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i);
      if (m) return { email: m[0].toLowerCase() };
      return null;
    }
    case 'collect_brand': {
      if (t.length >= 2 && t.length <= 60 && !t.includes('?')) {
        return { brand: text.trim() };
      }
      return null;
    }
    case 'collect_category': {
      if (/food|beverage|restaurant|cafe|qsr|kitchen|bakery/.test(t)) return { category: 'Food & Beverage' };
      if (/retail|apparel|clothing|grocery|lifestyle/.test(t)) return { category: 'Retail' };
      if (/salon|service|repair|home service/.test(t)) return { category: 'Services' };
      if (/educat|coaching|school|preschool|training/.test(t)) return { category: 'Education' };
      if (/health|wellness|fitness|gym|clinic|spa/.test(t)) return { category: 'Health & Wellness' };
      return null;
    }
    case 'collect_outlets': {
      const m = t.match(/(\d+)/);
      if (m) {
        const n = Number(m[1]);
        if (n === 1) return { outlets: '1' };
        if (n >= 2 && n <= 4) return { outlets: '2-4' };
        if (n >= 5) return { outlets: '5+' };
      }
      if (/only one|single|just one/.test(t)) return { outlets: '1' };
      if (/two|three|four|few/.test(t)) return { outlets: '2-4' };
      if (/many|five|ten|lots|multiple/.test(t)) return { outlets: '5+' };
      return null;
    }
    case 'collect_city': {
      if (t.length >= 2 && t.length <= 40 && /^[a-z .'-]+$/i.test(text.trim())) {
        return { city: text.trim() };
      }
      return null;
    }
    case 'collect_service_type': {
      if (/\bboth\b/.test(t)) return { serviceType: 'both' };
      if (/recruit|franchisee|find/.test(t)) return { serviceType: 'recruitment_only' };
      if (/consult|full|build|system|sop/.test(t)) return { serviceType: 'full_consulting' };
      return null;
    }
    case 'collect_sops': {
      if (/yes|documented|already|ready|have|done/.test(t)) return { sopsDocumented: 'yes' };
      if (/no|need|help|support|building|not yet/.test(t)) return { sopsDocumented: 'need_support' };
      return null;
    }
    case 'collect_goal': {
      if (/international|global|overseas|abroad/.test(t)) return { mainGoal: 'international' };
      if (/india|country|national|pan[- ]?india/.test(t)) return { mainGoal: 'across_india' };
      if (/one city|single city|local|city only/.test(t)) return { mainGoal: 'one_city' };
      return null;
    }
    case 'collect_timeline': {
      if (/this month|immediately|asap|right away/.test(t)) return { timeline: 'this_month' };
      if (/1.?3|one.*three|next quarter|next month|2 months/.test(t)) return { timeline: '1_3_months' };
      if (/6 months|half year/.test(t)) return { timeline: '6_months' };
      if (/explor|not sure|no.*date|someday|later/.test(t)) return { timeline: 'exploring' };
      return null;
    }
    case 'collect_capital': {
      if (/\b(2|3|4|5|10)\s?cr|crore/.test(t)) return { capital: 'gt_100' };
      if (/\b50.?l|60.?l|70.?l|80.?l|90.?l|1\s?cr/.test(t)) return { capital: '50_100' };
      if (/\b25.?l|30.?l|35.?l|40.?l|45.?l/.test(t)) return { capital: '25_50' };
      if (/\b10.?l|15.?l|20.?l/.test(t)) return { capital: '10_25' };
      if (/\b5.?l|under\s*10|less than|small/.test(t)) return { capital: 'lt_10' };
      return null;
    }
    case 'close_booking': {
      if (/call|phone|ring|voice/.test(t)) return { closeChoice: 'call_me' };
      if (/later|not now|busy|next week/.test(t)) return { closeChoice: 'later' };
      if (/yes|sure|ok|link|send|book|go ahead|please do/.test(t)) return { closeChoice: 'send_link' };
      return null;
    }
    default:
      return null;
  }
}

/** Score rubric from button answers into 0-25 dimension scores. */
export function scoresFromAnswers(a: FlowAnswers): Record<string, number> {
  const s: Record<string, number> = {};
  if (a.outlets === '1') s.score_location = 5;
  if (a.outlets === '2-4') s.score_location = 15;
  if (a.outlets === '5+') s.score_location = 22;

  if (a.timeline === 'this_month') s.score_timeline = 25;
  if (a.timeline === '1_3_months') s.score_timeline = 20;
  if (a.timeline === '6_months') s.score_timeline = 15;
  if (a.timeline === 'exploring') s.score_timeline = 5;

  if (a.capital === 'lt_10') s.score_capital = 4;
  if (a.capital === '10_25') s.score_capital = 10;
  if (a.capital === '25_50') s.score_capital = 16;
  if (a.capital === '50_100') s.score_capital = 22;
  if (a.capital === 'gt_100') s.score_capital = 25;

  if (a.serviceType && (a.timeline === 'this_month' || a.timeline === '1_3_months')) {
    s.score_commitment = 22;
  } else if (a.serviceType) {
    s.score_commitment = 15;
  }

  if (a.sopsDocumented === 'yes') s.score_experience = 20;
  else if (a.sopsDocumented === 'need_support') s.score_experience = 10;

  return s;
}

/**
 * Short acknowledgement sent AFTER a valid answer, right before the next step's prompt.
 * These are sales "warm bridges" — specific, contextual, never generic.
 */
export function acknowledgement(step: FlowStepId, a: FlowAnswers, session: BotSessionDocument): string {
  const name = fName(session);
  switch (step) {
    case 'collect_email':
      return `Got it — noted ${a.email}.`;

    case 'collect_brand':
      return `*${a.brand}* — love the name.`;

    case 'collect_category':
      return `Great, ${a.category} is one of our strongest categories.`;

    case 'collect_outlets': {
      // Value-inject based on scale — this is where sales momentum gets built.
      if (a.outlets === '1')
        return `Perfect — a single outlet is the ideal stage to build the franchise blueprint right.`;
      if (a.outlets === '2-4')
        return `That's the inflection point — this is exactly where systematising pays off the most.`;
      return `Excellent — you're already at the scale where the right growth partner moves the needle fastest.`;
    }

    case 'collect_city':
      return `Noted — ${a.city}.`;

    case 'collect_service_type':
      if (a.serviceType === 'both')
        return `Got it — end-to-end support is usually the highest-ROI path.`;
      if (a.serviceType === 'recruitment_only')
        return `Understood — we'll focus on getting you qualified franchisees.`;
      return `Understood — building the system first sets the right foundation.`;

    case 'collect_sops':
      return a.sopsDocumented === 'yes'
        ? `Perfect, that will speed things up significantly.`
        : `Noted — that's one of the first things we'd build together.`;

    case 'collect_goal':
      if (a.mainGoal === 'international') return `Ambitious — we love that.`;
      if (a.mainGoal === 'across_india') return `Pan-India — got it.`;
      return `One-city focus — solid foundation before scaling.`;

    case 'collect_timeline':
      if (a.timeline === 'this_month' || a.timeline === '1_3_months')
        return `Great, you're moving at the right pace.`;
      return `Noted, ${name} — gives us room to build things properly.`;

    case 'collect_capital':
      return `Thanks, that helps us match you to the right programme.`;

    default:
      return '';
  }
}

/**
 * If the parser / LLM couldn't extract anything valid, this is the gentle retry prompt
 * we send BEFORE re-issuing the step prompt, so the user doesn't feel ignored.
 */
export function softRetry(step: FlowStepId): string | null {
  switch (step) {
    case 'collect_email':
      return `I didn't catch a valid email there — could you share it in the format *name@example.com*?`;
    case 'collect_city':
      return `Could you share just the *city name*? For example — Mumbai, Bengaluru, Delhi.`;
    case 'collect_brand':
      return `Could you share your *brand name* — just the name is enough.`;
    default:
      return null;
  }
}
