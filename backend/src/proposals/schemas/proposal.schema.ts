import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProposalDocument = Proposal & Document;

@Schema({ timestamps: true })
export class Proposal {
  @Prop({ required: true })
  leadId!: string;

  @Prop({ required: true })
  leadName!: string;

  @Prop({ required: true })
  track!: string;

  @Prop({ required: true })
  program!: string;

  @Prop({ required: true, default: 'Draft' })
  status!: string;

  @Prop({ required: true })
  content!: string;

  @Prop({ required: true, type: String })
  createdAt!: string;

  @Prop({ type: String, default: null })
  sentAt!: string | null;

  @Prop({ type: String, default: null })
  openedAt!: string | null;

  @Prop({ type: String, default: null })
  signedAt!: string | null;
}

export const ProposalSchema = SchemaFactory.createForClass(Proposal);
ProposalSchema.index({ leadId: 1, status: 1 });
