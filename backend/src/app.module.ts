import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { validate } from './config/validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { ClientsModule } from './clients/clients.module';
import { ProposalsModule } from './proposals/proposals.module';
import { ActivitiesModule } from './activities/activities.module';
import { CallsModule } from './calls/calls.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AlertsModule } from './alerts/alerts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AutomationModule } from './automation/automation.module';
import { SettingsModule } from './settings/settings.module';
import { ScorecardModule } from './scorecard/scorecard.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { VoiceModule } from './voice/voice.module';
import { CalendarModule } from './calendar/calendar.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI,
      }),
    }),
    UsersModule,
    AuthModule,
    LeadsModule,
    ClientsModule,
    ProposalsModule,
    ActivitiesModule,
    CallsModule,
    NotificationsModule,
    AlertsModule,
    DashboardModule,
    AutomationModule,
    SettingsModule,
    ScorecardModule,
    WebhooksModule,
    VoiceModule,
    CalendarModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
