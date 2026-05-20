import { IsString, IsOptional, IsIn, IsNumber, Min } from 'class-validator';

export class CreateFundDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @IsIn(['LP', 'LLC', 'OTHER'])
  legalForm?: string;

  @IsOptional()
  @IsString()
  jurisdictionCode?: string;

  @IsOptional()
  @IsString()
  baseCurrency?: string;
}

export class UpdateFundDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['LP', 'LLC', 'OTHER'])
  legalForm?: string;

  @IsOptional()
  @IsString()
  jurisdictionCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetCommitment?: number;
}
