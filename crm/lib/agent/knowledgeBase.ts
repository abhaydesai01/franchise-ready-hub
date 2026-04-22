export const KB: Record<string, string> = {
  faq_cost:
    "Great question. Investment is tailored to your business, so Rahul maps it properly on the Discovery Call instead of giving a one-size-fits-all number.",
  faq_process:
    "Process is simple: free assessment first, then system build, then launch support. The Discovery Call is the no-risk starting point.",
  faq_about_fr:
    "Franchise Ready is led by Rahul Malik, with 20+ years in franchising. We have worked as franchisees and franchisor advisors, so the guidance stays practical.",
  faq_timeline:
    "Timeline depends on how systemized your business already is. Most brands take 3-12 months to build the right franchise foundation.",
  faq_programmes:
    "There are structured programmes from foundational setup to full growth support. The right fit depends on your current stage.",
  faq_success:
    "One recent client expanded from operator-led growth into a structured franchise model with our team. The playbook is always tailored, never copy-paste.",
  faq_team:
    "You work directly with Rahul and a hands-on specialist team, not a junior handoff.",
  faq_whatsapp_bot:
    "Yes, Freddy is an AI assistant for Franchise Ready. This chat gets you the right answers quickly and routes your case to Rahul's team when needed.",
  objection_not_ready:
    "That is completely fair. A free assessment can simply show where your business stands today, even if you do nothing immediately.",
  objection_think:
    "Absolutely, take your time. If one specific question is blocking clarity, we can resolve that first.",
  objection_price:
    "Fair point, and we have not mapped your investment yet. Fit and investment are clarified properly on the Discovery Call.",
  objection_not_sure:
    "That is the most honest place to start. The free assessment exists exactly to test fit before any commitment.",
  out_of_scope:
    "That is best answered by Rahul's team directly. I have noted it for follow-up, and you can also reach them at info@franchise-ready.in or +91 9833393077.",
  investor_intent:
    "Understood, you are exploring franchise investment, not franchising your own brand. Salman from our recruitment team is the right person to connect you with.",
  signal_ready_to_book:
    "Given what you shared, a Discovery Call with Rahul is the smartest next step to map your exact path.",
  frustration_signal:
    "You are right to call that out. Let me make this easier and get a human from the team to take over quickly.",
};

export function getKbContext(intent: string): string | null {
  return KB[intent] ?? null;
}

