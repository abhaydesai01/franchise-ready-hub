import { IsIn } from 'class-validator';

export class DiscoveryCallPatchDto {
  @IsIn(['completed'])
  status!: 'completed';
}
