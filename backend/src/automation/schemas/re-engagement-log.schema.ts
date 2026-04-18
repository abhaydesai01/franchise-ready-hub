import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ReEngagementLogDocument = HydratedDocument<ReEngagementLog>;

@Schema({ collection: 're_engagement_logs', timestamps: false })
export class ReEngagementLog {
  @Prop({ required: true })
  ruleId!: string;

  @Prop({ required: true })
  ruleName!: string;

  @Prop({ required: true })
  leadId!: string;

  @Prop({ required: true })
  leadName!: string;

  @Prop({ required: true })
  trigger!: string;

  @Prop({ type: [Object], default: [] })
  actionsExecuted!: Record<string, unknown>[];

  @Prop({ required: true })
  outcome!: string;

  @Prop({ type: Date, required: true })
  triggeredAt!: Date;
}

export const ReEngagementLogSchema =
  SchemaFactory.createForClass(ReEngagementLog);
ReEngagementLogSchema.index({ triggeredAt: -1 });
ReEngagementLogSchema.index({ ruleId: 1 });
