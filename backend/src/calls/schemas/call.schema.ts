import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CallDocument = DiscoveryCall & Document;

@Schema({ timestamps: true })
export class DiscoveryCall {
  @Prop({ required: true })
  leadId!: string;

  @Prop({ required: true })
  leadName!: string;

  @Prop({ required: true })
  track!: string;

  @Prop({ required: true, default: 0 })
  score!: number;

  @Prop({ required: true })
  scheduledAt!: string;

  @Prop({
    required: true,
    enum: ['upcoming', 'completed', 'noshow'],
    default: 'upcoming',
  })
  status!: 'upcoming' | 'completed' | 'noshow';

  @Prop({ default: '' })
  notes!: string;

  @Prop({ default: false })
  proposalGenerated!: boolean;

  @Prop({ default: 'Unassigned' })
  consultantName!: string;

  @Prop({ default: '' })
  calcomLink!: string;

  @Prop({ default: false })
  followUpSent?: boolean;
}

export const CallSchema = SchemaFactory.createForClass(DiscoveryCall);
CallSchema.index({ status: 1, scheduledAt: -1 });
