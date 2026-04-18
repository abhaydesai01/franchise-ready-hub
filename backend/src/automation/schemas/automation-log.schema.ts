import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AutomationLogDocument = HydratedDocument<AutomationLog>;

@Schema({ collection: 'automation_logs', timestamps: false })
export class AutomationLog {
  @Prop({ required: true })
  leadId!: string;

  @Prop({ required: true })
  leadName!: string;

  @Prop({ required: true })
  sequenceName!: string;

  @Prop({ required: true })
  step!: number;

  @Prop({ required: true, enum: ['WhatsApp', 'Email', 'Voice'] })
  channel!: 'WhatsApp' | 'Email' | 'Voice';

  @Prop({ required: true, enum: ['Pending', 'Sent', 'Opened', 'Failed'] })
  status!: 'Pending' | 'Sent' | 'Opened' | 'Failed';

  @Prop({ type: Date, required: true })
  sentAt!: Date;

  @Prop({ type: Date, default: null })
  openedAt!: Date | null;
}

export const AutomationLogSchema = SchemaFactory.createForClass(AutomationLog);
AutomationLogSchema.index({ sentAt: -1 });
AutomationLogSchema.index({ leadId: 1 });
