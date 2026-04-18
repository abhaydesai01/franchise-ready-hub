import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAutomationSequenceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  track?: string;

  @IsOptional()
  @IsArray()
  steps?: {
    id: string;
    stepNumber: number;
    delay: number;
    delayUnit: 'hours' | 'days';
    channel: 'WhatsApp' | 'Email' | 'Voice';
    template: string;
  }[];

  @IsOptional()
  @IsNumber()
  activeLeads?: number;

  @IsOptional()
  @IsString()
  lastTriggered?: string;
}
