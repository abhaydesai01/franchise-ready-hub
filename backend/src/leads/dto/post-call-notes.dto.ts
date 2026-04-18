import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export type PostCallOutcome = 'ready_to_proceed' | 'needs_more_time' | 'not_interested';
export type PostCallServiceType =
  | 'full_consulting'
  | 'recruitment_only'
  | 'needs_development';
export type PostCallDocRequired = 'proposal' | 'mom' | 'none';

export class PostCallNotesDto {
  @IsIn(['ready_to_proceed', 'needs_more_time', 'not_interested'])
  outcome!: PostCallOutcome;

  @ValidateIf((o: PostCallNotesDto) => o.outcome !== 'not_interested')
  @IsIn(['full_consulting', 'recruitment_only', 'needs_development'], {
    message: 'serviceType is required unless prospect is not interested',
  })
  serviceType?: PostCallServiceType;

  @IsString()
  @IsNotEmpty()
  @MinLength(20, {
    message: 'Describe what was agreed in at least 20 characters.',
  })
  engagementScope!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  priceDiscussed?: number;

  @IsOptional()
  @IsString()
  objections?: string;

  @IsOptional()
  @IsString()
  commitments?: string;

  @IsString()
  @IsNotEmpty()
  consultantNotes!: string;

  @IsIn(['proposal', 'mom', 'none'])
  docRequired!: PostCallDocRequired;

  @IsString()
  @IsNotEmpty()
  nextStep!: string;
}
