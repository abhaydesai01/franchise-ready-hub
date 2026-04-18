import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReEngagementRuleDocument = HydratedDocument<ReEngagementRule>;

@Schema({ collection: 're_engagement_rules', timestamps: false })
export class ReEngagementRule {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  trigger!: string;

  @Prop({ required: true })
  triggerLabel!: string;

  @Prop({ type: Object, default: {} })
  conditions!: Record<string, unknown>;

  @Prop({ type: [Object], default: [] })
  actions!: Record<string, unknown>[];

  @Prop({ default: true })
  enabled!: boolean;

  @Prop({ default: 0 })
  totalTriggered!: number;

  @Prop({ default: 0 })
  successRate!: number;

  @Prop({ type: Date, default: null })
  lastTriggered!: Date | null;

  @Prop({ required: true })
  createdAt!: string;
}

export const ReEngagementRuleSchema =
  SchemaFactory.createForClass(ReEngagementRule);
