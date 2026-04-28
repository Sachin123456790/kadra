import {
  IsString,
  IsOptional,
  IsEmail,
  IsIn,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class CreateInvestorDto {
  @IsString()
  legalName: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsIn(['UNKNOWN', 'VERIFIED', 'REVOKED'])
  verificationStatus?: string;
}

export class LinkWalletDto {
  @IsInt()
  chainId: number;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateVerificationDto {
  @IsOptional()
  @IsString()
  @IsIn(['UNKNOWN', 'VERIFIED', 'REVOKED'])
  verificationStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  kycStatus?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  accreditationStatus?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
