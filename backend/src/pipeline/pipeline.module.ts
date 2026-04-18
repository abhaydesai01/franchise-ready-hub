import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PipelineStage,
  PipelineStageSchema,
} from './schemas/pipeline-stage.schema';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PipelineStage.name, schema: PipelineStageSchema },
    ]),
  ],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
