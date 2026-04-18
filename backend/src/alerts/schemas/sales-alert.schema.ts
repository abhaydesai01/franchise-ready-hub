import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SalesAlertDocument = SalesAlert & Document;

@Schema({ timestamps: true })
export class SalesAlert {
  @Prop({ required: true, unique: true })
  alertKey!: string;

  @Prop({ required: true })
  leadId!: string;

  @Prop({ required: true })
  leadName!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true, enum: ['critical', 'warning', 'info'] })
  priority!: 'critical' | 'warning' | 'info';

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  createdAt!: string;

  @Prop({ default: false })
  dismissed!: boolean;

  @Prop()
  actionLabel?: string;

  @Prop()
  actionType?: string;
}

export const SalesAlertSchema = SchemaFactory.createForClass(SalesAlert);
SalesAlertSchema.index({ priority: 1, dismissed: 1, createdAt: -1 });
