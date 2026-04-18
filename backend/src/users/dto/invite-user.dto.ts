import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import type { UserRole } from '../schemas/user.schema';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsIn(['admin', 'manager', 'rep'])
  @IsOptional()
  role?: UserRole;
}
