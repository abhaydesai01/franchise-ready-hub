import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Outbound Vaani voice agent attempt + outcome (stored on Lead). */
@Schema({ _id: false })
export class VoiceCallEntry {
  @Prop({ required: true })
  vaaniCallId!: string;

  @Prop({ type: Date, required: true })
  triggeredAt!: Date;

  @Prop({ required: true })
  triggerReason!: string;

  @Prop({
    default: 'initiated',
  })
  status!: string;

  @Prop({ default: 0 })
  duration!: number;

  @Prop({ default: '' })
  transcript!: string;

  @Prop({ default: '' })
  summary!: string;

  @Prop({ default: '' })
  sentiment!: string;

  @Prop({ type: Object, default: {} })
  entities!: Record<string, unknown>;

  @Prop({ default: '' })
  recordingUrl!: string;

  /** From trigger response, e.g. `AD_xxx` */
  @Prop({ type: String })
  vaaniDispatchId?: string;

  @Prop({ type: String })
  callEvalTag?: string;

  @Prop({ type: Object, required: false })
  conversationEval?: Record<string, unknown>;

  @Prop({ type: Date })
  lastEnrichedAt?: Date;

  @Prop({ default: '' })
  outcome!: string;

  @Prop({ type: Date })
  callbackRequestedAt?: Date;

  @Prop({ type: Number })
  slotOfferedIndex?: number;

  @Prop({ type: Date })
  completedAt?: Date;

  /** Set when Gemini applied scorecard + track from this call (idempotent). */
  @Prop({ type: Date })
  geminiScorecardAt?: Date;

  /** Set when a Google/Meet booking was created from this call (idempotent). */
  @Prop({ type: Date })
  calendarBookedAt?: Date;
}

export const VoiceCallEntrySchema = SchemaFactory.createForClass(VoiceCallEntry);
