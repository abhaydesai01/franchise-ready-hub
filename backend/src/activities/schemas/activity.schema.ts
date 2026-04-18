import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ActivityDocument = Activity & Document;

@Schema({ timestamps: true })
export class Activity {
  @Prop({ required: true })
  leadId!: string;

  @Prop({ required: true })
  leadName!: string;

  @Prop({ required: true })
  type!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true })
  timestamp!: string;

  @Prop()
  addedBy?: string;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
ActivitySchema.index({ leadId: 1, timestamp: -1 });
