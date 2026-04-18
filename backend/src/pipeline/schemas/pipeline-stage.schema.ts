import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PipelineStageDocument = HydratedDocument<PipelineStage>;

@Schema({ timestamps: true })
export class PipelineStage {
  @Prop({ required: true })
  name!: string;

  /** Kanban swimlane / track this column belongs to */
  @Prop({ required: true })
  track!: string;

  @Prop({ required: true, default: 0 })
  order!: number;

  @Prop({ default: 0 })
  probability!: number;

  @Prop({ default: '#94a3b8' })
  color!: string;

  @Prop({ default: true })
  isActive!: boolean;
}

export const PipelineStageSchema = SchemaFactory.createForClass(PipelineStage);

PipelineStageSchema.index({ track: 1, order: 1 });
PipelineStageSchema.index({ track: 1, name: 1 }, { unique: true });
