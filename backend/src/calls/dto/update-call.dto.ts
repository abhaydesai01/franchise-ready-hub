import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateCallDto {
  @IsString()
  @IsIn(['upcoming', 'completed', 'noshow'])
  @IsOptional()
  status?: 'upcoming' | 'completed' | 'noshow';

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  proposalGenerated?: boolean;

  @IsBoolean()
  @IsOptional()
  followUpSent?: boolean;
}
