import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  signedDate?: string;

  @IsString()
  @IsOptional()
  program?: string;

  @IsString()
  @IsOptional()
  onboardingStatus?: string;

  @IsNumber()
  @IsOptional()
  onboardingProgress?: number;

  @IsString()
  @IsOptional()
  referralCode?: string;

  @IsArray()
  @IsOptional()
  referrals?: Array<{ name: string; stage: string; addedDate: string }>;
}
