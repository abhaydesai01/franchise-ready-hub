import { IsBoolean } from 'class-validator';

export class UpdateReEngagementRuleDto {
  @IsBoolean()
  enabled!: boolean;
}
