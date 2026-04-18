import { IsNotEmpty, IsString } from 'class-validator';

export class TrackProposalDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
