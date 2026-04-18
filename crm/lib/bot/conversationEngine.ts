import mongoose from 'mongoose';
import { formatPhone, sendBotTemplate } from '@/lib/whatsapp';
import { connectDB } from '@/lib/mongodb';
import { Lead, type LeadDocument } from '@/models/Lead';
import { getCrmSettings } from '@/models/CrmSettings';
import { logWhatsAppActivity } from './activityLogger';
import type { InboundMessageInput } from './inboundTypes';
import type { TemplateMessage } from './templates';
import * as Msg from './botMessages';
import {
  computeFranchiseReadinessScore,
  type CapitalBand,
  type BusinessExperience,
  type PropertyStatus,
  type Motivation,
  type IntentSignal,
} from './scoringEngine';
import {
  enqueueVoiceFallback30m,
  cancelLeadJobs,
  cancelVoiceFallbackJob,
} from '@/lib/queues';
import { triggerScorecardGeneration } from '@/lib/triggerScorecard';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function replyPayload(input: InboundMessageInput): string {
  return (input.listReplyId ?? input.buttonId ?? input.text ?? '').trim();
}

function inboundBody(input: InboundMessageInput): string {
  return (input.text ?? input.buttonTitle ?? '').trim();
}

function firstName(lead: { name?: string }): string {
  const n = (lead.name ?? 'there').trim().split(/\s+/)[0];
  return n || 'there';
}

function needsName(lead: { name?: string }): boolean {
  const n = (lead.name ?? '').trim();
  return n.length < 2 || /^meta\s*lead$/i.test(n);
}

function needsEmail(lead: { email?: string | null }): boolean {
  return !(lead.email && EMAIL_RE.test(lead.email));
}

function needsPhone(lead: { phone?: string | null }): boolean {
  const p = (lead.phone ?? '').replace(/\D/g, '');
  return p.length < 10;
}

function isOffScript(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\?/.test(text) ||
    /\b(what|who|why|how)\b/i.test(t) ||
    t.includes('what is this') ||
    t.includes('who are you')
  );
}

function normalizePhoneDigits(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10) return `91${d}`;
  return d;
}

function mapListToCapital(id: string): CapitalBand | null {
  const m: Record<string, CapitalBand> = {
    cap_A: 'A',
    cap_B: 'B',
    cap_C: 'C',
    cap_D: 'D',
    cap_E: 'E',
  };
  return m[id] ?? null;
}

function mapListToExperience(id: string): BusinessExperience | null {
  const m: Record<string, BusinessExperience> = {
    exp_A: 'A',
    exp_B: 'B',
    exp_C: 'C',
    exp_D: 'D',
  };
  return m[id] ?? null;
}

function mapListToProperty(id: string): PropertyStatus | null {
  const m: Record<string, PropertyStatus> = {
    prop_A: 'A',
    prop_B: 'B',
    prop_C: 'C',
    prop_D: 'D',
  };
  return m[id] ?? null;
}

function mapListToMotivation(id: string): Motivation | null {
  const m: Record<string, Motivation> = {
    mot_A: 'A',
    mot_B: 'B',
    mot_C: 'C',
    mot_D: 'D',
  };
  return m[id] ?? null;
}

function mapListToIntent(id: string): IntentSignal | null {
  if (id === 'int_A') return 'active';
  if (id === 'int_B') return 'mid';
  if (id === 'int_C') return 'exploring';
  return null;
}

async function sendOutbound(
  lead: { _id: mongoose.Types.ObjectId; name: string; phone?: string | null },
  phone: string,
  message: TemplateMessage,
  botState: string,
): Promise<void> {
  const res = await sendBotTemplate(phone, message);
  const preview =
    message.type === 'text'
      ? message.text
      : `[interactive:${(message.interactive as { type?: string }).type ?? 'ui'}]`;
  await logWhatsAppActivity({
    leadId: lead._id,
    direction: 'outbound',
    body: preview.slice(0, 4000),
    botState,
    waMessageId: res.messageId,
  });
}

async function logInbound(
  leadId: mongoose.Types.ObjectId,
  body: string,
  botState: string | null | undefined,
  waMessageId: string,
): Promise<void> {
  await logWhatsAppActivity({
    leadId,
    direction: 'inbound',
    body: body.slice(0, 4000),
    botState: botState ?? undefined,
    waMessageId,
  });
}

/** First step after warm intro acknowledgement. */
function nextStateAfterWarmIntro(lead: LeadDocument): string {
  if (needsName(lead)) return 'COLLECT_NAME';
  if (needsEmail(lead)) return 'COLLECT_EMAIL';
  if (needsPhone(lead)) return 'COLLECT_PHONE';
  return 'Q1';
}

function promptForState(state: string): TemplateMessage {
  switch (state) {
    case 'COLLECT_NAME':
      return Msg.collectNameMessage();
    case 'COLLECT_EMAIL':
      return Msg.collectEmailMessage();
    case 'COLLECT_PHONE':
      return Msg.collectPhoneMessage();
    case 'Q1':
      return Msg.q1CapitalList();
    case 'Q2':
      return Msg.q2ExperienceList();
    case 'Q3':
      return Msg.q3LocationPrompt();
    case 'Q4':
      return Msg.q4PropertyList();
    case 'Q5':
      return Msg.q5MotivationList();
    case 'INTENT_SIGNAL':
      return Msg.intentSignalList();
    default:
      return Msg.collectNameMessage();
  }
}

async function applyScoringFromLead(leadId: mongoose.Types.ObjectId): Promise<LeadDocument | null> {
  const lead = await Lead.findById(leadId).lean();
  if (!lead?.scorecardAnswers) return null;
  const a = lead.scorecardAnswers as Record<string, string>;
  const capitalBand = a.capitalBand as CapitalBand | undefined;
  const businessExperience = a.businessExperience as BusinessExperience | undefined;
  const targetLocation = a.targetLocation ?? '';
  const propertyStatus = a.propertyStatus as PropertyStatus | undefined;
  const motivation = (a.motivation as Motivation) ?? 'A';
  const intentSignal = lead.intentSignal as IntentSignal | undefined;
  if (
    !capitalBand ||
    !businessExperience ||
    !targetLocation ||
    !propertyStatus ||
    !motivation ||
    !intentSignal
  ) {
    return null;
  }
  const result = computeFranchiseReadinessScore({
    capitalBand,
    businessExperience,
    targetLocationText: targetLocation,
    propertyStatus,
    motivation,
    intentSignal,
  });

  const track =
    result.readinessBand === 'franchise_ready'
      ? 'franchise_ready'
      : result.readinessBand === 'recruitment_only'
        ? 'recruitment_only'
        : 'not_ready';

  const tags = new Set([...(lead.tags ?? []), result.readinessBand]);
  const updated = await Lead.findByIdAndUpdate(
    leadId,
    {
      $set: {
        botState: 'SLOT_OFFER',
        totalScore: result.total,
        readinessBand: result.readinessBand,
        scoringCompletedAt: new Date(),
        score: result.total,
        stage: 'scoring_completed',
        track,
        tags: Array.from(tags),
        scoreDimensions: [
          { name: 'Capital', score: result.breakdown.capital, max: 25 },
          { name: 'Experience', score: result.breakdown.experience, max: 20 },
          { name: 'Location', score: result.breakdown.location, max: 10 },
          { name: 'Property', score: result.breakdown.property, max: 20 },
          { name: 'Motivation', score: result.breakdown.motivation, max: 10 },
          { name: 'Intent', score: result.breakdown.intent, max: 15 },
        ],
      },
    },
    { new: true },
  ).exec();
  return updated;
}

/**
 * Send warm intro for a Meta lead — call after Lead is saved with phone.
 * Sets botState WARM_INTRO, sends one message, schedules 30m voice fallback.
 */
async function maybeRecordProposalCheckinReply(
  leadId: string,
  replySnippet: string,
): Promise<void> {
  const raw =
    process.env.BACKEND_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    '';
  if (!raw) return;
  const base = raw.replace(/\/$/, '').replace(/\/api\/v1$/i, '');
  const secret = process.env.INTERNAL_WEBHOOK_SECRET?.trim();
  if (!secret) return;

  const lead = await Lead.findById(leadId).lean();
  if (!lead) return;
  const l = lead as {
    proposalCheckinSentAt?: Date;
    proposalCheckinReplyAlertAt?: Date;
    documents?: Array<{ documentType?: string; status?: string }>;
  };
  if (!l.proposalCheckinSentAt || l.proposalCheckinReplyAlertAt) return;
  const proposals = (l.documents ?? []).filter((d) => d.documentType === 'proposal');
  const latest = proposals[proposals.length - 1];
  if (!latest || latest.status === 'signed') return;

  const res = await fetch(`${base}/api/v1/internal/proposals/checkin-reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({
      leadId,
      replySnippet: replySnippet.slice(0, 2000),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error('[conversationEngine] checkin-reply API', res.status, t);
  }
}

export async function sendWarmIntroForLead(leadId: string): Promise<void> {
  await connectDB();
  const lead = await Lead.findById(leadId);
  if (!lead?.phone) return;
  const phone = formatPhone(lead.phone);
  const { companyName } = await getCrmSettings();
  const fn = firstName(lead);

  await Lead.findByIdAndUpdate(lead._id, { $set: { botState: 'WARM_INTRO' } }).exec();

  const fresh = await Lead.findById(lead._id);
  if (!fresh) return;

  const msg = Msg.warmIntroMessage(fn, companyName);
  await sendOutbound(fresh, phone, msg, 'WARM_INTRO');

  try {
    await enqueueVoiceFallback30m({
      leadId: String(fresh._id),
      phone,
      name: fresh.name,
      expectedBotState: 'WARM_INTRO',
    });
  } catch (e) {
    console.error('[conversationEngine] enqueue warm intro voice fallback', e);
  }
}

export async function handleInboundMessage(input: InboundMessageInput): Promise<void> {
  await connectDB();
  const phone = formatPhone(input.from);
  const bodyText = inboundBody(input);
  const rid = replyPayload(input);

  let lead = await Lead.findOne({ phone }).exec();
  if (!lead) {
    lead = await Lead.create({
      name: 'WhatsApp lead',
      phone,
      source: 'whatsapp_inbound',
      track: 'not_ready',
      stage: 'new',
      status: 'new',
      score: 0,
      scoreDimensions: [],
      botState: 'WARM_INTRO',
    });
    await logInbound(lead._id, bodyText || rid, 'WARM_INTRO', input.messageId);
    const { companyName } = await getCrmSettings();
    await sendOutbound(lead, phone, Msg.warmIntroMessage(firstName(lead), companyName), 'WARM_INTRO');
    try {
      await enqueueVoiceFallback30m({
        leadId: String(lead._id),
        phone,
        name: lead.name,
        expectedBotState: 'WARM_INTRO',
      });
    } catch (e) {
      console.error('[conversationEngine] voice fallback', e);
    }
    return;
  }

  await logInbound(lead._id, bodyText || rid, lead.botState, input.messageId);

  void maybeRecordProposalCheckinReply(String(lead._id), bodyText || rid).catch((e) =>
    console.error('[conversationEngine] proposal check-in reply', e),
  );

  /** Cancel pending 30m VAPI fallback if lead responds while still in intro or slot-offer. */
  try {
    if (lead.botState === 'WARM_INTRO') {
      await cancelVoiceFallbackJob(String(lead._id), 'warm_intro');
    }
    if (lead.botState === 'SLOT_OFFER') {
      await cancelVoiceFallbackJob(String(lead._id), 'slot_offer');
    }
  } catch (e) {
    console.error('[conversationEngine] cancel voice fallback', e);
  }

  const state = lead.botState ?? 'WARM_INTRO';

  if (/^(stop|unsubscribe|opt out)$/i.test(bodyText) || /^stop$/i.test(bodyText)) {
    await Lead.findByIdAndUpdate(lead._id, { $set: { status: 'dead', stage: 'dead' } }).exec();
    return;
  }

  /** Resume SCORING if crashed mid-compute */
  if (state === 'SCORING') {
    const done = await applyScoringFromLead(lead._id);
    if (done) {
      triggerScorecardGeneration(String(done._id));
      const { calendlyLink } = await getCrmSettings();
      if (!calendlyLink) {
        console.error('[conversationEngine] calendlyLink missing in CrmSettings');
      }
      await sendOutbound(done, phone, Msg.slotOfferMessage(calendlyLink || 'https://calendly.com'), 'SLOT_OFFER');
      try {
        await enqueueVoiceFallback30m({
          leadId: String(done._id),
          phone,
          name: done.name,
          expectedBotState: 'SLOT_OFFER',
        });
      } catch (e) {
        console.error('[conversationEngine] slot voice fallback', e);
      }
    }
    return;
  }

  if (state === 'BOOKING_CONFIRMED') {
    return;
  }

  /** Off-script: repeat current question */
  const interactiveStates = ['Q1', 'Q2', 'Q4', 'Q5', 'INTENT_SIGNAL'];
  if (
    interactiveStates.includes(state) &&
    input.type === 'text' &&
    bodyText.length > 0 &&
    isOffScript(bodyText)
  ) {
    const repeat = promptForState(state);
    const summary =
      repeat.type === 'text'
        ? repeat.text
        : 'please choose an option from the list above.';
    await sendOutbound(lead, phone, Msg.offScriptHelper(summary), state);
    return;
  }

  switch (state) {
    case 'WARM_INTRO': {
      const next = nextStateAfterWarmIntro(lead);
      await Lead.findByIdAndUpdate(lead._id, { $set: { botState: next } }).exec();
      const updated = await Lead.findById(lead._id);
      if (!updated) return;
      await sendOutbound(updated, phone, promptForState(next), next);
      return;
    }
    case 'COLLECT_NAME': {
      if (bodyText.length < 2) {
        await sendOutbound(lead, phone, Msg.collectNameMessage(), 'COLLECT_NAME');
        return;
      }
      await Lead.findByIdAndUpdate(lead._id, { $set: { name: bodyText.trim() } }).exec();
      const after = await Lead.findById(lead._id).lean();
      if (!after) return;
      const next = needsEmail(after) ? 'COLLECT_EMAIL' : needsPhone(after) ? 'COLLECT_PHONE' : 'Q1';
      await Lead.findByIdAndUpdate(lead._id, { $set: { botState: next } }).exec();
      const updated = await Lead.findById(lead._id);
      if (!updated) return;
      await sendOutbound(updated, phone, promptForState(next), next);
      return;
    }
    case 'COLLECT_EMAIL': {
      if (!EMAIL_RE.test(bodyText)) {
        await sendOutbound(lead, phone, Msg.invalidEmailMessage(), 'COLLECT_EMAIL');
        return;
      }
      await Lead.findByIdAndUpdate(lead._id, {
        $set: { email: bodyText.toLowerCase() },
      }).exec();
      const after = await Lead.findById(lead._id).lean();
      if (!after) return;
      const next = needsPhone(after) ? 'COLLECT_PHONE' : 'Q1';
      await Lead.findByIdAndUpdate(lead._id, { $set: { botState: next } }).exec();
      const updated = await Lead.findById(lead._id);
      if (!updated) return;
      await sendOutbound(updated, phone, promptForState(next), next);
      return;
    }
    case 'COLLECT_PHONE': {
      const digits = normalizePhoneDigits(bodyText);
      if (digits.replace(/\D/g, '').length < 10) {
        await sendOutbound(lead, phone, Msg.invalidPhoneMessage(), 'COLLECT_PHONE');
        return;
      }
      await Lead.findByIdAndUpdate(lead._id, {
        $set: { phone: formatPhone(digits) },
      }).exec();
      await Lead.findByIdAndUpdate(lead._id, { $set: { botState: 'Q1' } }).exec();
      const updated = await Lead.findById(lead._id);
      if (!updated) return;
      await sendOutbound(updated, formatPhone(digits), Msg.q1CapitalList(), 'Q1');
      return;
    }
    case 'Q1': {
      const id = rid || '';
      const band = mapListToCapital(id);
      if (!band) {
        await sendOutbound(lead, phone, Msg.q1CapitalList(), 'Q1');
        return;
      }
      await Lead.findByIdAndUpdate(lead._id, {
        $set: { 'scorecardAnswers.capitalBand': band, botState: 'Q2' },
      }).exec();
      const updated = await Lead.findById(lead._id);
      if (!updated) return;
      await sendOutbound(updated, phone, Msg.q2ExperienceList(), 'Q2');
      return;
    }
    case 'Q2': {
      const id = rid || '';
      const exp = mapListToExperience(id);
      if (!exp) {
        await sendOutbound(lead, phone, Msg.q2ExperienceList(), 'Q2');
        return;
      }
      await Lead.findByIdAndUpdate(lead._id, {
        $set: { 'scorecardAnswers.businessExperience': exp, botState: 'Q3' },
      }).exec();
      const updated = await Lead.findById(lead._id);
      if (!updated) return;
      await sendOutbound(updated, phone, Msg.q3LocationPrompt(), 'Q3');
      return;
    }
    case 'Q3': {
      if (bodyText.length < 2) {
        await sendOutbound(lead, phone, Msg.q3LocationPrompt(), 'Q3');
        return;
      }
      await Lead.findByIdAndUpdate(lead._id, {
        $set: { 'scorecardAnswers.targetLocation': bodyText.trim(), botState: 'Q4' },
      }).exec();
      const updated = await Lead.findById(lead._id);
      if (!updated) return;
      await sendOutbound(updated, phone, Msg.q4PropertyList(), 'Q4');
      return;
    }
    case 'Q4': {
      const id = rid || '';
      const prop = mapListToProperty(id);
      if (!prop) {
        await sendOutbound(lead, phone, Msg.q4PropertyList(), 'Q4');
        return;
      }
      await Lead.findByIdAndUpdate(lead._id, {
        $set: { 'scorecardAnswers.propertyStatus': prop, botState: 'Q5' },
      }).exec();
      const updated = await Lead.findById(lead._id);
      if (!updated) return;
      await sendOutbound(updated, phone, Msg.q5MotivationList(), 'Q5');
      return;
    }
    case 'Q5': {
      const id = rid || '';
      const mot = mapListToMotivation(id);
      if (!mot) {
        await sendOutbound(lead, phone, Msg.q5MotivationList(), 'Q5');
        return;
      }
      await Lead.findByIdAndUpdate(lead._id, {
        $set: { 'scorecardAnswers.motivation': mot, botState: 'INTENT_SIGNAL' },
      }).exec();
      const updated = await Lead.findById(lead._id);
      if (!updated) return;
      await sendOutbound(updated, phone, Msg.intentSignalList(), 'INTENT_SIGNAL');
      return;
    }
    case 'INTENT_SIGNAL': {
      const id = rid || '';
      const intent = mapListToIntent(id);
      if (!intent) {
        await sendOutbound(lead, phone, Msg.intentSignalList(), 'INTENT_SIGNAL');
        return;
      }
      await Lead.findByIdAndUpdate(lead._id, {
        $set: { intentSignal: intent, botState: 'SCORING' },
      }).exec();

      const scored = await applyScoringFromLead(lead._id);
      if (!scored) return;

      triggerScorecardGeneration(String(scored._id));

      const { calendlyLink } = await getCrmSettings();
      await sendOutbound(scored, phone, Msg.slotOfferMessage(calendlyLink || 'https://calendly.com'), 'SLOT_OFFER');
      try {
        await enqueueVoiceFallback30m({
          leadId: String(scored._id),
          phone: formatPhone(scored.phone ?? phone),
          name: scored.name,
          expectedBotState: 'SLOT_OFFER',
        });
      } catch (e) {
        console.error('[conversationEngine] slot voice fallback', e);
      }
      return;
    }
    case 'SLOT_OFFER':
      await sendOutbound(
        lead,
        phone,
        Msg.offScriptHelper('tap the booking link in our last message when you are ready.'),
        'SLOT_OFFER',
      );
      return;
    default: {
      await Lead.findByIdAndUpdate(lead._id, { $set: { botState: 'WARM_INTRO' } }).exec();
      const { companyName } = await getCrmSettings();
      const up = await Lead.findById(lead._id);
      if (!up) return;
      await sendOutbound(up, phone, Msg.warmIntroMessage(firstName(up), companyName), 'WARM_INTRO');
    }
  }
}

export async function confirmBookingFromCalendly(leadId: string): Promise<void> {
  await connectDB();
  await cancelLeadJobs(leadId);
  const lead = await Lead.findByIdAndUpdate(
    leadId,
    { $set: { botState: 'BOOKING_CONFIRMED', stage: 'discovery_booked' } },
    { new: true },
  ).exec();
  if (!lead?.phone) return;
  await sendOutbound(
    lead,
    formatPhone(lead.phone),
    Msg.bookingConfirmedMessage(),
    'BOOKING_CONFIRMED',
  );
}
