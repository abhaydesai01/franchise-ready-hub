import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VaaniTestCallDto {
  /** E.164 or local digits to call instead of the lead’s stored phone */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneOverride?: string;
}
