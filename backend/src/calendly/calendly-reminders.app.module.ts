import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from '../config/configuration';
import { validate } from '../config/validation';
import { BriefingModule } from '../briefing/briefing.module';

/**
 * Minimal Nest context for `calendly-reminders.worker.ts` (1h briefing email + shared config).
 */
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
    BriefingModule,
  ],
})
export class CalendlyRemindersAppModule {}
