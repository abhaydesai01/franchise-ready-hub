import { IsNotEmpty, IsString } from 'class-validator';

export class SignProposalDto {
  @IsString()
  @IsNotEmpty()
  signaturePngBase64!: string;
}
