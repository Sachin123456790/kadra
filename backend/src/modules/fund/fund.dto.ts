import { IsString, IsOptional, IsIn } from 'class-validator';

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
