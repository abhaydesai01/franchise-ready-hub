import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from '../config/configuration';
import { validate } from '../config/validation';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { SettingsModule } from '../settings/settings.module';
import { AlertsModule } from '../alerts/alerts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProposalFollowupRunnerService } from './proposal-followup-runner.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({ uri: process.env.MONGODB_URI }),
    }),
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    WhatsappModule,
    SettingsModule,
    AlertsModule,
    NotificationsModule,
  ],
  providers: [ProposalFollowupRunnerService],
})
export class ProposalFollowupWorkerModule {}
