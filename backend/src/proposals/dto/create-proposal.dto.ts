import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  @IsNotEmpty()
  leadId!: string;

  @IsString()
  @IsNotEmpty()
  program!: string;

  @IsString()
  callNotes!: string;
}
