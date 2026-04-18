import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateProposalStatusDto {
  @IsString()
  @IsNotEmpty()
  status!: string;
}
