import { IsMongoId } from 'class-validator';

export class UpdateLeadOwnerDto {
  @IsMongoId()
  ownerId!: string;
}
