import { IsIn, IsOptional, IsString } from 'class-validator';
import type { UserRole } from '../schemas/user.schema';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsIn(['admin', 'manager', 'rep'])
  @IsOptional()
  role?: UserRole;
}
