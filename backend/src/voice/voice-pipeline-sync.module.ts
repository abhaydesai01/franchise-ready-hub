import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ActivitiesModule } from '../activities/activities.module';
import { VoicePipelineSyncService } from './voice-pipeline-sync.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lead.name, schema: LeadSchema }]),
    PipelineModule,
    ActivitiesModule,
  ],
  providers: [VoicePipelineSyncService],
  exports: [VoicePipelineSyncService],
})
export class VoicePipelineSyncModule {}
