import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProposalViewEventDocument = ProposalViewEvent & Document;

@Schema({ timestamps: true, collection: 'proposal_view_events' })
export class ProposalViewEvent {
  @Prop({ required: true })
  leadId!: string;

  /** Lead.documents subdocument _id */
  @Prop({ required: true })
  documentEntryId!: string;

  @Prop({ required: true })
  proposalViewToken!: string;

  @Prop({ required: true })
  viewedAt!: Date;

  @Prop()
  userAgent?: string;

  @Prop()
  ipAddress?: string;
}

export const ProposalViewEventSchema =
  SchemaFactory.createForClass(ProposalViewEvent);
ProposalViewEventSchema.index({ proposalViewToken: 1, viewedAt: -1 });
ProposalViewEventSchema.index({ leadId: 1, documentEntryId: 1 });
