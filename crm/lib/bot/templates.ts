import type { ListSection } from '../whatsapp';

export type TemplateText = { type: 'text'; text: string };
export type TemplateInteractive = { type: 'interactive'; interactive: Record<string, unknown> };
export type TemplateMessage = TemplateText | TemplateInteractive;

export function isTemplateInteractive(m: TemplateMessage): m is TemplateInteractive {
  return m.type === 'interactive';
}

const calDefault = 'https://cal.com/franchise-ready/discovery';

export const templates = {
  welcome(name?: string): TemplateText {
    const n = name?.trim() ? `Hi ${name.trim()}, ` : 'Hi, ';
    return {
      type: 'text',
      text: `${n}welcome to Franchise Ready! Ready to explore franchising with us? Reply *Yes* to begin, or *Stop* anytime to opt out.`,
    };
  },

  askName(): TemplateText {
    return { type: 'text', text: 'What is your full name?' };
  },

  askEmail(name: string): TemplateText {
    return {
      type: 'text',
      text: `Thanks ${name}! What is the best email address to reach you on?`,
    };
  },

  /** When the user types free text during scoring instead of using the list/buttons. */
  scoringFreetextHelper(): TemplateText {
    return {
      type: 'text',
      text: 'No problem — quick clarification: for this step please use the *buttons* or *list menu* above so we can score you accurately. If something is unclear, reply here after you have tapped an option, or say *human* and our team will jump in.',
    };
  },

  scoringNudgeSoft(round: 1 | 2): TemplateText {
    if (round === 1) {
      return {
        type: 'text',
        text: 'Just checking in — when you have a moment, use the list or buttons in our last message so we can continue your Franchise Ready assessment.',
      };
    }
    return {
      type: 'text',
      text: 'We are still waiting on that last step. One tap on the options above keeps everything on track — thank you!',
    };
  },

  scoringQ1b(): TemplateInteractive {
    const sections: ListSection[] = [
      {
        title: 'Investment capital',
        rows: [
          { id: 'cap_1', title: 'Under ₹5L' },
          { id: 'cap_2', title: '₹5L – ₹20L' },
          { id: 'cap_3', title: '₹20L – ₹50L' },
          { id: 'cap_4', title: '₹50L – ₹1Cr' },
          { id: 'cap_5', title: 'Above ₹1Cr' },
        ],
      },
    ];
    return {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: 'Roughly how much capital can you allocate to your first franchise?' },
        action: {
          button: 'Select range',
          sections: sections.map((s) => ({
            title: s.title.slice(0, 24),
            rows: s.rows.map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
            })),
          })),
        },
      },
    };
  },

  scoringQ2(): TemplateInteractive {
    const sections: ListSection[] = [
      {
        title: 'Experience',
        rows: [
          { id: 'exp_1', title: '0 years' },
          { id: 'exp_2', title: '1–2 years' },
          { id: 'exp_3', title: '3–5 years' },
          { id: 'exp_4', title: '6–10 years' },
          { id: 'exp_5', title: '10+ years' },
        ],
      },
    ];
    return {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: 'How many years have you run your own business or led a team?' },
        action: {
          button: 'Select years',
          sections: sections.map((s) => ({
            title: s.title.slice(0, 24),
            rows: s.rows.map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
            })),
          })),
        },
      },
    };
  },

  scoringQ3(): TemplateInteractive {
    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'How many territories or outlets are you aiming to open in the next 24 months?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'loc_1', title: '1 territory' } },
            { type: 'reply', reply: { id: 'loc_2', title: '2–5 territories' } },
            { type: 'reply', reply: { id: 'loc_5', title: '5+ territories' } },
          ],
        },
      },
    };
  },

  scoringQ4(): TemplateInteractive {
    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'How committed are you to launching a franchise in the next 6–12 months?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'com_1', title: 'Still exploring' } },
            { type: 'reply', reply: { id: 'com_2', title: 'Somewhat committed' } },
            { type: 'reply', reply: { id: 'com_3', title: 'Fully committed' } },
          ],
        },
      },
    };
  },

  scoringQ5(): TemplateInteractive {
    const sections: ListSection[] = [
      {
        title: 'Timeline',
        rows: [
          { id: 'time_1', title: '0–3 months' },
          { id: 'time_2', title: '3–6 months' },
          { id: 'time_3', title: '6–12 months' },
          { id: 'time_4', title: '12+ months' },
        ],
      },
    ];
    return {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: 'When do you want your first franchisee operational?' },
        action: {
          button: 'Select timeline',
          sections: sections.map((s) => ({
            title: s.title.slice(0, 24),
            rows: s.rows.map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
            })),
          })),
        },
      },
    };
  },

  scoredNotReady(name: string, score: number): TemplateText {
    return {
      type: 'text',
      text: `${name}, thanks for sharing — your readiness score is *${score}/100*. We will keep sharing bite-sized education on franchising so you can move forward when the time is right.`,
    };
  },

  scoredReady(name: string, score: number): TemplateText {
    return {
      type: 'text',
      text: `${name}, great news — you scored *${score}/100*. You look like a strong fit for Franchise Ready. Reply *book* when you are ready and we will send a discovery call link.`,
    };
  },

  scoredRecruitmentOnly(name: string, score: number): TemplateText {
    return {
      type: 'text',
      text: `${name}, thanks — score *${score}/100*. Based on your answers, our recruitment-only path may suit you best. Our team will follow up with next steps.`,
    };
  },

  sendBookingLink(name: string, calLink?: string): TemplateText {
    const link = calLink ?? calDefault;
    return {
      type: 'text',
      text: `${name}, here is your discovery call link: ${link}\nPick a slot that works for you — we will send reminders before the call.`,
    };
  },

  callReminder24h(name: string, dateTime: string): TemplateText {
    return {
      type: 'text',
      text: `Hi ${name}, reminder: your Franchise Ready discovery call is in 24 hours (${dateTime}). Need to reschedule? Reply *reschedule*.`,
    };
  },

  callReminder1h(name: string, dateTime: string): TemplateText {
    return {
      type: 'text',
      text: `Hi ${name}, your discovery call starts in 1 hour (${dateTime}). We are looking forward to meeting you!`,
    };
  },

  nurtureDay1(name: string): TemplateText {
    return {
      type: 'text',
      text: `Hi ${name}, day 1 tip: the best franchisees validate *unit economics* before signing — ask for Item 19 and talk to 2–3 existing franchisees.`,
    };
  },

  nurtureDay3(name: string): TemplateText {
    return {
      type: 'text',
      text: `Hi ${name}, quick read: map your *skills* (ops, sales, marketing) to what the franchisor expects day-to-day — gaps become your hiring plan.`,
    };
  },

  nurtureDay7(name: string): TemplateText {
    return {
      type: 'text',
      text: `${name}, by now you should have a shortlist. Reply *interested* when you want to book a discovery call with our consultant.`,
    };
  },

  nurtureDay14(name: string): TemplateText {
    return {
      type: 'text',
      text: `${name}, franchising is a 5–10 year partnership — alignment on values and support matters as much as the brand name. Happy to discuss on a call.`,
    };
  },

  nurtureDay20(name: string): TemplateText {
    return {
      type: 'text',
      text: `${name}, final nudge from nurture: if timing is the only blocker, ask about phased rollout options — many brands offer flexible territory ramps.`,
    };
  },

  optOutConfirmation(): TemplateText {
    return {
      type: 'text',
      text: 'You have been unsubscribed from Franchise Ready WhatsApp updates. Reply *start* anytime in the future to reconnect.',
    };
  },

  proposalSent(name: string, consultantName: string): TemplateText {
    return {
      type: 'text',
      text: `Hi ${name}, ${consultantName} has sent your proposal document. Open it on desktop for the best experience — questions welcome.`,
    };
  },

  clientWelcome(name: string): TemplateText {
    return {
      type: 'text',
      text: `Congratulations ${name}! Welcome to Franchise Ready — your onboarding checklist will arrive shortly.`,
    };
  },
};
