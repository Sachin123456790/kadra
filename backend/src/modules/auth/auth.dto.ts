import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { UserRole } from '../../common/auth/auth.types';

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsIn([
    'admin',
    'platform_admin',
    'fund_admin',
    'operations_analyst',
    'investor',
  ])
  role?: UserRole;

  @IsOptional()
  @IsString()
  adminSignupSecret?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
