import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class DayHoursDto {
  @IsString()
  @IsOptional()
  start?: string;

  @IsString()
  @IsOptional()
  end?: string;

  @IsOptional()
  enabled?: boolean;
}

class WorkingHoursDto {
  @ValidateNested()
  @Type(() => DayHoursDto)
  @IsOptional()
  monday?: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  @IsOptional()
  tuesday?: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  @IsOptional()
  wednesday?: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  @IsOptional()
  thursday?: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  @IsOptional()
  friday?: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  @IsOptional()
  saturday?: DayHoursDto;

  @ValidateNested()
  @Type(() => DayHoursDto)
  @IsOptional()
  sunday?: DayHoursDto;
}

export class UpdateAvailabilityDto {
  @IsNumber()
  @IsOptional()
  slotDurationMinutes?: number;

  @IsNumber()
  @IsOptional()
  bufferBetweenSlots?: number;

  @ValidateNested()
  @Type(() => WorkingHoursDto)
  @IsOptional()
  workingHours?: WorkingHoursDto;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsNumber()
  @IsOptional()
  advanceBookingDays?: number;

  @IsNumber()
  @IsOptional()
  slotsToOfferInBot?: number;

  @IsString()
  @IsOptional()
  meetingTitle?: string;

  @IsString()
  @IsOptional()
  ghlBookingLink?: string;

  @IsString()
  @IsOptional()
  primaryConsultantUserId?: string;
}
