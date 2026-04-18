import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BrandingContactDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  supportEmail?: string;

  @IsString()
  @IsOptional()
  supportPhone?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  addressLine?: string;
}

class ThresholdsDto {
  @IsNumber()
  @IsOptional()
  notReadyBelow?: number;

  @IsNumber()
  @IsOptional()
  franchiseReadyMin?: number;

  @IsNumber()
  @IsOptional()
  franchiseReadyMax?: number;
}

class AlertRulesDto {
  @IsNumber()
  @IsOptional()
  coldLeadDaysWarning?: number;

  @IsNumber()
  @IsOptional()
  coldLeadDaysCritical?: number;

  @IsNumber()
  @IsOptional()
  stuckStageDaysWarning?: number;

  @IsNumber()
  @IsOptional()
  stuckStageDaysCritical?: number;

  @IsNumber()
  @IsOptional()
  proposalNotOpenedDaysInfo?: number;

  @IsNumber()
  @IsOptional()
  proposalNotOpenedDaysWarning?: number;
}

class IntegrationDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  icon!: string;

  @IsBoolean()
  connected!: boolean;

  @IsString()
  apiKey!: string;
}

class WATemplateDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  body!: string;

  @IsString()
  channel!: string;
}

class EmailTemplateDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  subject!: string;

  @IsString()
  body!: string;

  @IsBoolean()
  isHtml!: boolean;

  @IsString()
  channel!: string;
}

export class UpdateSettingsDto {
  @IsString()
  @IsOptional()
  calendlyLink?: string;

  @IsString()
  @IsOptional()
  calendlyWebhookSigningKey?: string;

  @IsNumber()
  @IsOptional()
  voiceFallbackDelayMinutes?: number;

  @IsNumber()
  @IsOptional()
  maxVoiceAttempts?: number;

  @IsString()
  @IsOptional()
  vaaniAgentId?: string;

  @IsString()
  @IsOptional()
  vaaniOutboundNumber?: string;

  @ValidateNested()
  @Type(() => BrandingContactDto)
  @IsOptional()
  branding?: BrandingContactDto;

  @ValidateNested()
  @Type(() => ThresholdsDto)
  @IsOptional()
  thresholds?: ThresholdsDto;

  @ValidateNested()
  @Type(() => AlertRulesDto)
  @IsOptional()
  alertRules?: AlertRulesDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntegrationDto)
  @IsOptional()
  integrations?: IntegrationDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WATemplateDto)
  @IsOptional()
  waTemplates?: WATemplateDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailTemplateDto)
  @IsOptional()
  emailTemplates?: EmailTemplateDto[];
}
