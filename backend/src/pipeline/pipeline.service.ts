import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PipelineStage,
  PipelineStageDocument,
} from './schemas/pipeline-stage.schema';

const DEFAULT_STAGES: Array<{
  track: string;
  name: string;
  order: number;
  probability: number;
  color: string;
}> = [
  {
    track: 'Not Ready',
    name: 'Gap Nurture',
    order: 0,
    probability: 10,
    color: '#64748b',
  },
  {
    track: 'Not Ready',
    name: 'Not Early',
    order: 1,
    probability: 15,
    color: '#78716c',
  },
  {
    track: 'Not Ready',
    name: 'Discovery Call',
    order: 2,
    probability: 25,
    color: '#0ea5e9',
  },
  {
    track: 'Not Ready',
    name: 'Convert to Consulting',
    order: 3,
    probability: 35,
    color: '#6366f1',
  },
  {
    track: 'Franchise Ready',
    name: 'Discovery Booked',
    order: 0,
    probability: 40,
    color: '#8b5cf6',
  },
  {
    track: 'Franchise Ready',
    name: 'Reminders Sent',
    order: 1,
    probability: 55,
    color: '#a855f7',
  },
  {
    track: 'Franchise Ready',
    name: 'Proposal Sent',
    order: 2,
    probability: 70,
    color: '#d946ef',
  },
  {
    track: 'Franchise Ready',
    name: 'Signed',
    order: 3,
    probability: 100,
    color: '#22c55e',
  },
  {
    track: 'Recruitment Only',
    name: 'Routed to Eden',
    order: 0,
    probability: 20,
    color: '#f97316',
  },
];

@Injectable()
export class PipelineService implements OnModuleInit {
  constructor(
    @InjectModel(PipelineStage.name)
    private readonly stageModel: Model<PipelineStageDocument>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultStages();
  }

  async ensureDefaultStages(): Promise<void> {
    const count = await this.stageModel.countDocuments().exec();
    if (count > 0) return;

    await this.stageModel.insertMany(
      DEFAULT_STAGES.map((s) => ({
        ...s,
        isActive: true,
      })),
    );
  }

  async listByTrack(
    track?: string,
  ): Promise<Array<PipelineStage & { _id: string }>> {
    const filter = track ? { track, isActive: true } : { isActive: true };
    return this.stageModel
      .find(filter)
      .sort({ track: 1, order: 1 })
      .lean<Array<PipelineStage & { _id: string }>>()
      .exec();
  }

  async findById(
    id: string,
  ): Promise<(PipelineStage & { _id: string }) | null> {
    return this.stageModel
      .findById(id)
      .lean<PipelineStage & { _id: string }>()
      .exec();
  }

  async findDefaultStageForNewLead(): Promise<PipelineStage & { _id: string }> {
    const stage = await this.stageModel
      .findOne({ track: 'Not Ready', name: 'Gap Nurture' })
      .lean<PipelineStage & { _id: string }>()
      .exec();
    if (!stage) {
      throw new BadRequestException(
        'Pipeline is not seeded; no default stage found',
      );
    }
    return stage;
  }

  async findFirstStageForTrack(
    track: string,
  ): Promise<(PipelineStage & { _id: string }) | null> {
    return this.stageModel
      .findOne({ track, isActive: true })
      .sort({ order: 1 })
      .lean<PipelineStage & { _id: string }>()
      .exec();
  }

  async findStageByTrackAndName(
    track: string,
    name: string,
  ): Promise<(PipelineStage & { _id: string }) | null> {
    return this.stageModel
      .findOne({ track, name, isActive: true })
      .lean<PipelineStage & { _id: string }>()
      .exec();
  }

  async reorder(track: string, stageIds: string[]): Promise<void> {
    const existing = await this.stageModel
      .find({ track })
      .select('_id')
      .lean<Array<{ _id: string }>>()
      .exec();

    const existingSet = new Set(existing.map((s) => String(s._id)));
    if (existing.length !== stageIds.length) {
      throw new BadRequestException(
        'stageIds must include every stage for this track exactly once',
      );
    }

    for (const id of stageIds) {
      if (!existingSet.has(id)) {
        throw new BadRequestException(
          `Stage ${id} is not part of track "${track}"`,
        );
      }
    }

    await Promise.all(
      stageIds.map((id, index) =>
        this.stageModel
          .updateOne({ _id: id, track }, { $set: { order: index } })
          .exec(),
      ),
    );
  }
}
