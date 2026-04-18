import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ClientDocument = Client & Document;

@Schema({ _id: false })
export class ClientReferral {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  stage!: string;

  @Prop({ required: true })
  addedDate!: string;
}

const ClientReferralSchema = SchemaFactory.createForClass(ClientReferral);

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true, unique: true })
  leadId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  signedDate!: string;

  @Prop({ required: true })
  program!: string;

  @Prop({ required: true, default: 'Pending' })
  onboardingStatus!: string;

  @Prop({ required: true, default: 0 })
  onboardingProgress!: number;

  @Prop({ required: true })
  referralCode!: string;

  @Prop({ type: [ClientReferralSchema], default: [] })
  referrals!: ClientReferral[];
}

export const ClientSchema = SchemaFactory.createForClass(Client);
