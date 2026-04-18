import { IsArray, IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class ReorderPipelineStagesDto {
  @IsString()
  @IsNotEmpty()
  track!: string;

  @IsArray()
  @IsMongoId({ each: true })
  stageIds!: string[];
}
