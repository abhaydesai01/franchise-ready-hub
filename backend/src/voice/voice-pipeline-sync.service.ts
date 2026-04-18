import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { PipelineService } from '../pipeline/pipeline.service';
import { ActivitiesService } from '../activities/activities.service';
import { inferVoiceOutcome } from './vaani-infer-outcome';

/**
 * Nudges pipeline stage (and in strong cases, track) after voice data exists so the Kanban
 * reflects the call without a manual move. Complements {@link GeminiVoiceScoringService}.
 */
@Injectable()
export class VoicePipelineSyncService {
  private readonly log = new Logger(VoicePipelineSyncService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly pipeline: PipelineService,
    private readonly activities: ActivitiesService,
  ) {}

  /**
   * Re-read lead + voice row and apply heuristics. Idempotent: safe to call after sync, webhook, worker.
   */
  async afterVoiceDataSaved(leadId: string, vaaniCallId: string): Promise<void> {
    const lead = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: Types.ObjectId }) | null>()
      .exec();
    if (!lead) return;

    if (String(lead.status) === 'Dead' || (lead as { stage?: string }).stage === 'not_interested') {
      return;
    }

    const vc = lead.voiceCalls?.find((c) => c.vaaniCallId === vaaniCallId);
    if (!vc) return;

    const summary = String(vc.summary ?? '');
    const entities = (vc.entities ?? {}) as Record<string, unknown>;
    const outcome: string =
      vc.outcome && String(vc.outcome).length
        ? String(vc.outcome)
        : inferVoiceOutcome(summary, entities);

    const isCompleted = String(vc.status) === 'completed' || Boolean(vc.completedAt);

    try {
      if (outcome === 'not_interested') {
        return;
      }

      if (outcome === 'booked') {
        if (lead.track === 'Franchise Ready') {
          return;
        }
        const stage =
          (await this.pipeline.findStageByTrackAndName('Franchise Ready', 'Discovery Booked')) ??
          (await this.pipeline.findFirstStageForTrack('Franchise Ready'));
        if (stage) {
          await this.leadModel
            .findByIdAndUpdate(leadId, {
              $set: {
                track: 'Franchise Ready',
                stage: stage.name,
                pipelineStageId: new Types.ObjectId(String(stage._id)),
              },
            })
            .exec();
          await this.activities.logVoiceCall(
            leadId,
            lead.name,
            'Pipeline: moved to Franchise Ready — ' + stage.name + ' (voice: booked).',
            true,
          );
        }
        return;
      }

      if (lead.track === 'Not Ready') {
        const bumpableStages = new Set(['Gap Nurture', 'Not Early']);
        if (!bumpableStages.has(lead.stage)) {
          return;
        }

        const shouldBumpToDiscoveryCall =
          outcome === 'callback_requested' ||
          (isCompleted && outcome === 'inconclusive' && summary.length > 40);

        if (shouldBumpToDiscoveryCall) {
          const stage = await this.pipeline.findStageByTrackAndName('Not Ready', 'Discovery Call');
          if (stage) {
            await this.leadModel
              .findByIdAndUpdate(leadId, {
                $set: {
                  stage: stage.name,
                  pipelineStageId: new Types.ObjectId(String(stage._id)),
                },
              })
              .exec();
            await this.activities.logVoiceCall(
              leadId,
              lead.name,
              'Pipeline: moved to Discovery Call after voice (follow-up or discovery touch).',
              true,
            );
          }
        }
      }
    } catch (e) {
      this.log.warn('Voice pipeline sync failed', e);
    }
  }
}
