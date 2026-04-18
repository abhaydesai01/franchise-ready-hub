import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AutomationSequenceDocument = HydratedDocument<AutomationSequence>;

@Schema({ collection: 'automation_sequences', timestamps: false })
export class AutomationSequence {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  track!: string;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        stepNumber: { type: Number, required: true },
        delay: { type: Number, required: true },
        delayUnit: { type: String, enum: ['hours', 'days'], required: true },
        channel: {
          type: String,
          enum: ['WhatsApp', 'Email', 'Voice'],
          required: true,
        },
        template: { type: String, required: true },
      },
    ],
    default: [],
  })
  steps!: {
    id: string;
    stepNumber: number;
    delay: number;
    delayUnit: 'hours' | 'days';
    channel: 'WhatsApp' | 'Email' | 'Voice';
    template: string;
  }[];

  @Prop({ default: 0 })
  activeLeads!: number;

  @Prop({ type: Date, required: true })
  lastTriggered!: Date;
}

export const AutomationSequenceSchema =
  SchemaFactory.createForClass(AutomationSequence);
