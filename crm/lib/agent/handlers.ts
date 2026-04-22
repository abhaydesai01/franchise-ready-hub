import { BotSession, type BotSessionDocument } from '@/models/BotSession';
import { Lead } from '@/models/Lead';
import type { FreddyIntent } from './classifier';
import { passiveScoreExtractor } from './goalTracker';

export type HandlerResult = {
  action: 'respond' | 'switch_to_voice' | 'switch_to_email' | 'book_call' | 'contact_team' | 'opt_out';
  note: string;
  data?: Record<string, unknown>;
};

export async function handleChannelPreference(
  session: BotSessionDocument,
  intent: FreddyIntent,
): Promise<HandlerResult> {
  if (intent === 'prefer_voice') {
    await BotSession.updateOne({ phone: session.phone }, { $set: { channelPreference: 'voice' } });
    return {
      action: 'switch_to_voice',
      data: { immediate: true },
      note: 'Lead indicated voice preference — firing immediately, no confirmation needed',
    };
  }
  await BotSession.updateOne({ phone: session.phone }, { $set: { channelPreference: 'email' } });
  return { action: 'switch_to_email', note: 'Lead indicated email preference' };
}

export async function handlePassiveScoring(
  session: BotSessionDocument,
  messageText: string,
): Promise<HandlerResult> {
  const extracted = await passiveScoreExtractor(messageText);
  if (!extracted) {
    return { action: 'respond', note: 'passive scoring attempted but nothing extracted' };
  }

  const evidenceUpdates: Record<string, unknown> = {};
  const trackerUpdates: Record<string, unknown> = {};
  for (const [dimension, score] of Object.entries(extracted)) {
    trackerUpdates[`goalTracker.score_${dimension}`] = score;
    evidenceUpdates[`scoringEvidence.${dimension}`] = messageText.substring(0, 120);
  }

  await BotSession.updateOne(
    { phone: session.phone },
    {
      $set: {
        ...trackerUpdates,
        ...evidenceUpdates,
      },
    },
  );

  return {
    action: 'respond',
    data: { passivelyScored: Object.keys(extracted) },
    note: `Passively scored ${Object.keys(extracted).join(', ')} from conversation`,
  };
}

export async function handleSignalReadyToBook(): Promise<HandlerResult> {
  return {
    action: 'book_call',
    note: 'Lead showing booking signals — offer Discovery Call as natural next step',
  };
}

export async function handleFrustration(session: BotSessionDocument): Promise<HandlerResult> {
  if (session.leadId) {
    const lead = await Lead.findById(session.leadId).lean();
    const append = 'Lead showed frustration signal — flagged for human follow-up';
    const notes = [lead?.notes, append].filter(Boolean).join(' | ');
    await Lead.updateOne(
      { _id: session.leadId },
      {
        $set: {
          notes,
          lastActivityType: 'freddy_frustration_signal',
          lastActivity: new Date().toISOString(),
        },
      },
    );
  }

  return { action: 'contact_team', note: 'Frustration detected — escalate to human, stop assessment flow' };
}

export async function handleDataCollection(
  session: BotSessionDocument,
  intent: FreddyIntent,
  text: string,
): Promise<HandlerResult> {
  const set: Record<string, unknown> = {};
  if (intent === 'provide_name') {
    set.collectedName = text.trim();
    set['goalTracker.has_name'] = true;
  } else if (intent === 'provide_email') {
    set.collectedEmail = text.trim().toLowerCase();
    set['goalTracker.has_email'] = true;
  } else if (intent === 'provide_phone') {
    set['goalTracker.has_phone'] = true;
  }
  await BotSession.updateOne({ phone: session.phone }, { $set: set });
  return { action: 'respond', note: `Collected ${intent.replace('provide_', '')}` };
}

export async function handleScoring(session: BotSessionDocument, intent: FreddyIntent): Promise<HandlerResult> {
  const map: Record<string, string> = {
    faq_timeline: 'timeline',
  };
  const dimension = map[intent];
  if (dimension) {
    await BotSession.updateOne(
      { phone: session.phone },
      { $set: { [`goalTracker.score_${dimension}`]: 15, [`scoringEvidence.${dimension}`]: 'Explicitly provided' } },
    );
  }
  return { action: 'respond', note: 'Handled explicit scoring signal' };
}

export async function handleInvestorIntent(session: BotSessionDocument): Promise<HandlerResult> {
  await BotSession.updateOne({ phone: session.phone }, { $set: { isInvestor: true } });
  return { action: 'contact_team', note: 'Investor lead — route to recruitment specialist' };
}

export async function handleOptOut(session: BotSessionDocument): Promise<HandlerResult> {
  await BotSession.updateOne({ phone: session.phone }, { $set: { optedOut: true } });
  return { action: 'opt_out', note: 'Lead opted out' };
}

export async function routeToHandler(
  session: BotSessionDocument,
  intent: FreddyIntent,
  messageText: string,
): Promise<HandlerResult> {
  if (intent === 'prefer_voice' || intent === 'prefer_email') return handleChannelPreference(session, intent);
  if (intent === 'investor_intent') return handleInvestorIntent(session);
  if (intent === 'frustration_signal') return handleFrustration(session);
  if (intent === 'signal_ready_to_book') return handleSignalReadyToBook();
  if (intent === 'passive_scoring_signal') return handlePassiveScoring(session, messageText);
  if (intent.startsWith('score_')) return handleScoring(session, intent);
  if (['provide_name', 'provide_email', 'provide_phone'].includes(intent)) {
    return handleDataCollection(session, intent, messageText);
  }
  if (intent === 'opt_out') return handleOptOut(session);
  if (intent === 'negative_response') {
    return { action: 'respond', note: 'Negative response — handled as objection_not_ready' };
  }
  if (intent === 'out_of_scope') {
    return { action: 'respond', note: 'Out-of-scope question — provide graceful fallback' };
  }
  return { action: 'respond', note: `Default conversational continuation for intent ${intent}` };
}

