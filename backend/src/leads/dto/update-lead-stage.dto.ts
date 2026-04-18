import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateLeadStageDto {
  @ValidateIf((o: UpdateLeadStageDto) => !o.pipelineStageId)
  @IsString()
  @IsNotEmpty()
  stage?: string;

  @IsString()
  @IsOptional()
  track?: string;

  @ValidateIf((o: UpdateLeadStageDto) => !o.stage)
  @IsMongoId()
  pipelineStageId?: string;
}
