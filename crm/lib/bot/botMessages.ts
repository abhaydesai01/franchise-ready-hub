import type { ListSection } from '../whatsapp';
import type { TemplateMessage } from './templates';

export function warmIntroMessage(firstName: string, companyName: string): TemplateMessage {
  return {
    type: 'text',
    text:
      `Hi ${firstName}! 👋 I'm from ${companyName}. You recently showed interest in franchise opportunities — that's exciting! ` +
      `Before we connect you with our team, I'd love to help you understand exactly where you stand with a quick Franchise Readiness Score. ` +
      `It takes less than 2 minutes and you'll get a personalised report instantly. Ready to begin?`,
  };
}

export function collectNameMessage(): TemplateMessage {
  return { type: 'text', text: 'What is your full name?' };
}

export function collectEmailMessage(): TemplateMessage {
  return {
    type: 'text',
    text: 'Thanks! What is the best email address to reach you on?',
  };
}

export function collectPhoneMessage(): TemplateMessage {
  return {
    type: 'text',
    text: 'And your mobile number (with country code if outside India)?',
  };
}

export function invalidEmailMessage(): TemplateMessage {
  return {
    type: 'text',
    text: "That doesn't look like a valid email — could you double-check and resend?",
  };
}

export function invalidPhoneMessage(): TemplateMessage {
  return {
    type: 'text',
    text: "That doesn't look like a valid phone number — please send at least 10 digits.",
  };
}

export function offScriptHelper(lastQuestionSummary: string): TemplateMessage {
  return {
    type: 'text',
    text:
      "I'm here to help you check your franchise readiness! Let's continue — " +
      lastQuestionSummary,
  };
}

export function q1CapitalList(): TemplateMessage {
  const sections: ListSection[] = [
    {
      title: 'Capital available',
      rows: [
        { id: 'cap_A', title: 'Under ₹10 lakhs' },
        { id: 'cap_B', title: '₹10–25 lakhs' },
        { id: 'cap_C', title: '₹25–50 lakhs' },
        { id: 'cap_D', title: '₹50 lakhs–1 crore' },
        { id: 'cap_E', title: 'Above ₹1 crore' },
      ],
    },
  ];
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text:
          'How much capital do you currently have available to invest in a franchise? (This includes savings, loans, or investor funds)',
      },
      action: {
        button: 'Choose range',
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
}

export function q2ExperienceList(): TemplateMessage {
  const sections: ListSection[] = [
    {
      title: 'Experience',
      rows: [
        { id: 'exp_A', title: 'Yes, I currently run' },
        { id: 'exp_B', title: 'Yes, previously' },
        { id: 'exp_C', title: 'No, management exp.' },
        { id: 'exp_D', title: 'No experience' },
      ],
    },
  ];
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: 'Have you ever run or managed a business before?',
      },
      action: {
        button: 'Select option',
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
}

export function q3LocationPrompt(): TemplateMessage {
  return {
    type: 'text',
    text: 'Which city or region are you planning to operate the franchise in? (Type your answer)',
  };
}

export function q4PropertyList(): TemplateMessage {
  const sections: ListSection[] = [
    {
      title: 'Property',
      rows: [
        { id: 'prop_A', title: 'I own a property' },
        { id: 'prop_B', title: 'Ready to lease' },
        { id: 'prop_C', title: 'Still exploring' },
        { id: 'prop_D', title: 'No plans yet' },
      ],
    },
  ];
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: 'Do you have a physical space or property available for the franchise, or are you open to leasing?',
      },
      action: {
        button: 'Select option',
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
}

export function q5MotivationList(): TemplateMessage {
  const sections: ListSection[] = [
    {
      title: 'Motivation',
      rows: [
        { id: 'mot_A', title: 'Financial independence' },
        { id: 'mot_B', title: 'Proven business model' },
        { id: 'mot_C', title: 'Brand support' },
        { id: 'mot_D', title: 'Supplement income' },
      ],
    },
  ];
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: 'What is your primary motivation for wanting a franchise?',
      },
      action: {
        button: 'Select option',
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
}

export function intentSignalList(): TemplateMessage {
  const sections: ListSection[] = [
    {
      title: 'Timeline',
      rows: [
        { id: 'int_A', title: 'Ready within 3 months' },
        { id: 'int_B', title: '3–6 months' },
        { id: 'int_C', title: 'Still exploring' },
      ],
    },
  ];
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text:
          'Last question — are you actively looking to start within the next 3 months, or are you still in the research phase?',
      },
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
}

export function slotOfferMessage(calendlyLink: string): TemplateMessage {
  return {
    type: 'text',
    text:
      'Great news — based on your score, our franchise consultant would love to connect with you for a quick discovery call! ' +
      `Here's our booking link to choose a time that works for you: ${calendlyLink} ` +
      "Once you book, you'll receive a confirmation and your Franchise Readiness Report on email.",
  };
}

export function bookingConfirmedMessage(): TemplateMessage {
  return {
    type: 'text',
    text:
      "Your discovery call is confirmed! You'll receive a calendar invite and your Franchise Readiness Report shortly. See you on the call! 🎯",
  };
}
