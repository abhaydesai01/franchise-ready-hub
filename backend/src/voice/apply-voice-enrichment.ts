import { Model } from 'mongoose';
import { LeadDocument } from '../leads/schemas/lead.schema';
import { VaaniService } from './vaani.service';
import { extractSlotIndex, inferVoiceOutcome, type VoiceInferredOutcome } from './vaani-infer-outcome';

/**
 * Fetches `GET /api/call_details/{room}` and `GET /api/transcript/{room}` and updates the
 * matching `voiceCalls[]` entry for webhooks, manual refresh, and worker jobs.
 */
export async function applyVoiceEnrichmentFromVaaniApis(
  leadModel: Model<LeadDocument>,
  vaani: VaaniService,
  leadId: string,
  roomName: string,
): Promise<'updated' | 'no_data' | 'not_found' | 'not_configured'> {
  if (!(await vaani.getConfig())) {
    return 'not_configured';
  }

  const lead = await leadModel
    .findOne({ _id: leadId, 'voiceCalls.vaaniCallId': roomName })
    .exec();
  if (!lead) {
    return 'not_found';
  }

  const payload = await vaani.fetchCallEnrichmentForRoom(roomName);
  if (!payload) {
    return 'no_data';
  }

  const { transcript, summary, entities, sentiment, callEvalTag, conversationEval } = payload;
  const hasData =
    transcript.length > 0 ||
    summary.length > 0 ||
    Object.keys(entities).length > 0;
  if (!hasData) {
    return 'no_data';
  }

  const outcome = inferVoiceOutcome(summary, entities) as VoiceInferredOutcome;
  const slotIdx = extractSlotIndex(entities, summary);

  const $set: Record<string, unknown> = {
    'voiceCalls.$[vc].transcript': transcript,
    'voiceCalls.$[vc].summary': summary,
    'voiceCalls.$[vc].entities': entities,
    'voiceCalls.$[vc].sentiment': sentiment,
    'voiceCalls.$[vc].outcome': outcome,
    'voiceCalls.$[vc].callEvalTag': callEvalTag,
    'voiceCalls.$[vc].conversationEval': conversationEval,
    'voiceCalls.$[vc].lastEnrichedAt': new Date(),
    /** If we have post-call text, the attempt is over from the CRM’s perspective. */
    'voiceCalls.$[vc].status': 'completed',
    'voiceCalls.$[vc].completedAt': new Date(),
  };
  if (typeof slotIdx === 'number' && slotIdx >= 1 && slotIdx <= 3) {
    $set['voiceCalls.$[vc].slotOfferedIndex'] = slotIdx;
  }

  await leadModel.updateOne(
    { _id: leadId, 'voiceCalls.vaaniCallId': roomName },
    { $set },
    { arrayFilters: [{ 'vc.vaaniCallId': roomName }] },
  );

  return 'updated';
}
