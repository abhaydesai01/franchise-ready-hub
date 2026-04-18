import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../users/schemas/user.schema';

export type CalendarIntegrationDocument = CalendarIntegration & Document;

@Schema({ timestamps: true, collection: 'calendar_integrations' })
export class CalendarIntegration {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ default: '' })
  googleAccessTokenEnc!: string;

  @Prop({ default: '' })
  googleRefreshTokenEnc!: string;

  @Prop({ type: Date })
  googleTokenExpiry?: Date;

  @Prop({ default: '' })
  googleEmail!: string;

  @Prop({ default: 'primary' })
  googleCalendarId!: string;

  @Prop({ default: '' })
  outlookAccessTokenEnc!: string;

  @Prop({ default: '' })
  outlookRefreshTokenEnc!: string;

  @Prop({ type: Date })
  outlookTokenExpiry?: Date;

  @Prop({ default: '' })
  outlookEmail!: string;

  @Prop({ default: false })
  isGoogleConnected!: boolean;

  @Prop({ default: false })
  isOutlookConnected!: boolean;

  @Prop({ type: Date })
  lastGoogleSyncAt?: Date;
}

export const CalendarIntegrationSchema =
  SchemaFactory.createForClass(CalendarIntegration);
