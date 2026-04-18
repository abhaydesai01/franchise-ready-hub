import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ActivitiesModule } from '../activities/activities.module';
import { GeminiVoiceScoringService } from './gemini-voice-scoring.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    PipelineModule,
    ActivitiesModule,
  ],
  providers: [GeminiVoiceScoringService],
  exports: [GeminiVoiceScoringService],
})
export class GeminiScoringModule {}
