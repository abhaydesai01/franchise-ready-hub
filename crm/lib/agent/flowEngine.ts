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
  capital?: 'lt_10' | '10_25' | '25_50' | 'gt_50';
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

/** Has this step's answer already been captured? */
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

/** Build the WhatsApp prompt for a given step. */
export function renderPrompt(step: FlowStepId, session: BotSessionDocument): Prompt | null {
  const name = fName(session);
  switch (step) {
    case 'collect_email':
      return {
        type: 'text',
        text: `Hi ${name}! I'm Freddy from Franchise Ready. To start, what is the best *email* to share next steps on?`,
      };

    case 'collect_brand':
      return {
        type: 'text',
        text: `Thanks! May I know your *brand name*?`,
      };

    case 'collect_category':
      return {
        type: 'list',
        body: `What *business category* are you in?`,
        buttonLabel: 'Choose category',
        sections: [
          {
            title: 'Categories',
            rows: [
              { id: 'cat_food', title: 'Food & Beverage', description: 'Restaurants, cafes, QSR, cloud kitchen' },
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
        body: `How many *operational outlets* do you currently run?`,
        buttons: [
          { id: 'outlets_1', title: 'Just 1' },
          { id: 'outlets_2_4', title: '2 to 4' },
          { id: 'outlets_5_plus', title: '5 or more' },
        ],
      };

    case 'collect_city':
      return {
        type: 'text',
        text: `Which *city* are you currently operating from?`,
      };

    case 'collect_service_type':
      return {
        type: 'buttons',
        body: `Are you looking for *full franchise consulting*, *franchise recruitment*, or *both*?`,
        buttons: [
          { id: 'svc_full', title: 'Full Consulting' },
          { id: 'svc_recruit', title: 'Recruitment' },
          { id: 'svc_both', title: 'Both' },
        ],
      };

    case 'collect_sops':
      return {
        type: 'buttons',
        body: `Have you already *documented your operations, costing, and SOPs*, or would you need support in building that?`,
        buttons: [
          { id: 'sops_yes', title: 'Yes, documented' },
          { id: 'sops_need', title: 'Need support' },
        ],
      };

    case 'collect_goal':
      return {
        type: 'buttons',
        body: `What is your main *goal* right now — expansion in one city, across India, or international growth?`,
        buttons: [
          { id: 'goal_city', title: 'One city' },
          { id: 'goal_india', title: 'Across India' },
          { id: 'goal_intl', title: 'International' },
        ],
      };

    case 'collect_timeline':
      return {
        type: 'list',
        body: `What *timeline* are you targeting to begin franchising?`,
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
        body: `Roughly, what *capital range* are you comfortable allocating for expansion?`,
        buttonLabel: 'Pick capital',
        sections: [
          {
            title: 'Capital range',
            rows: [
              { id: 'cap_lt10', title: 'Under ₹10L' },
              { id: 'cap_10_25', title: '₹10L – ₹25L' },
              { id: 'cap_25_50', title: '₹25L – ₹50L' },
              { id: 'cap_gt50', title: '₹50L or more' },
            ],
          },
        ],
      };

    case 'close_booking':
      return {
        type: 'buttons',
        body: `Thank you for sharing all that, ${name}. Based on what you told me, a short *Discovery Call* with Rahul will be the right next step.`,
        buttons: [
          { id: 'close_link', title: 'Send the link' },
          { id: 'close_call', title: 'Call me instead' },
          { id: 'close_later', title: 'Maybe later' },
        ],
      };

    case 'done':
      return null;

    default:
      return null;
  }
}

/** Map a tapped button or list-reply id to a structured answer. */
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
    cap_gt50: { capital: 'gt_50' },

    close_link: { closeChoice: 'send_link' },
    close_call: { closeChoice: 'call_me' },
    close_later: { closeChoice: 'later' },
  };
  const v = map[id];
  if (!v) return null;
  // Guard: only accept if the button belongs to the current step family.
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

/** Heuristic parsers so the user can answer a button step with plain text too. */
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
      if (/recruit/.test(t)) return { serviceType: 'recruitment_only' };
      if (/consult|full/.test(t)) return { serviceType: 'full_consulting' };
      return null;
    }
    case 'collect_sops': {
      if (/yes|documented|already|ready|have/.test(t)) return { sopsDocumented: 'yes' };
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
      if (/crore|\b50.?l|60.?l|70.?l|80.?l|90.?l|1\s?cr/.test(t)) return { capital: 'gt_50' };
      if (/\b25.?l|30.?l|35.?l|40.?l|45.?l/.test(t)) return { capital: '25_50' };
      if (/\b10.?l|15.?l|20.?l/.test(t)) return { capital: '10_25' };
      if (/\b5.?l|under\s*10|less than|small/.test(t)) return { capital: 'lt_10' };
      return null;
    }
    case 'close_booking': {
      if (/call|phone|ring|voice/.test(t)) return { closeChoice: 'call_me' };
      if (/later|not now|busy|next week/.test(t)) return { closeChoice: 'later' };
      if (/yes|sure|ok|link|send|go ahead|please do/.test(t)) return { closeChoice: 'send_link' };
      return null;
    }
    default:
      return null;
  }
}

/** Score rubric mapping from button answers to 0-25 dimension scores. */
export function scoresFromAnswers(a: FlowAnswers): Record<string, number> {
  const s: Record<string, number> = {};
  if (a.outlets === '1') s.score_location = 5;
  if (a.outlets === '2-4') s.score_location = 15;
  if (a.outlets === '5+') s.score_location = 22;

  if (a.timeline === 'this_month') s.score_timeline = 25;
  if (a.timeline === '1_3_months') s.score_timeline = 20;
  if (a.timeline === '6_months') s.score_timeline = 15;
  if (a.timeline === 'exploring') s.score_timeline = 5;

  if (a.capital === 'lt_10') s.score_capital = 5;
  if (a.capital === '10_25') s.score_capital = 12;
  if (a.capital === '25_50') s.score_capital = 18;
  if (a.capital === 'gt_50') s.score_capital = 25;

  // commitment is inferred: serious timeline + any service type selected = committed.
  if (a.serviceType && (a.timeline === 'this_month' || a.timeline === '1_3_months')) {
    s.score_commitment = 22;
  } else if (a.serviceType) {
    s.score_commitment = 15;
  }

  if (a.sopsDocumented === 'yes') s.score_experience = 20;
  else if (a.sopsDocumented === 'need_support') s.score_experience = 10;

  return s;
}

/** Short acknowledgement we say AFTER a valid answer, right before the next step's prompt. */
export function acknowledgement(step: FlowStepId, a: FlowAnswers, session: BotSessionDocument): string {
  const name = fName(session);
  switch (step) {
    case 'collect_email':
      return `Got it, I have noted ${a.email}.`;
    case 'collect_brand':
      return `Nice — ${a.brand}.`;
    case 'collect_category':
      return `Great, ${a.category}.`;
    case 'collect_outlets':
      return a.outlets === '1' ? `Single outlet — got it.` : `${a.outlets} outlets — noted.`;
    case 'collect_city':
      return `Noted, ${a.city}.`;
    case 'collect_service_type':
      return `Understood.`;
    case 'collect_sops':
      return a.sopsDocumented === 'yes' ? `Perfect, that will speed things up.` : `Noted, we can help you build those.`;
    case 'collect_goal':
      return `Got it.`;
    case 'collect_timeline':
      return `Thanks ${name}.`;
    case 'collect_capital':
      return `Noted.`;
    default:
      return '';
  }
}
