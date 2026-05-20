import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubscriptionItemDto {
  @IsString()
  investorId!: string;

  @IsString()
  walletId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  allocationPct!: number;

  // Accepts a numeric string from the client; coerced and bounded at >= 0 so a
  // negative commitment can never corrupt the cap table or token mint math.
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  committedAmount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  subscriptionRef!: string;
}

export class CreateSubscriptionsDto {
  @IsString()
  governingDocumentId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSubscriptionItemDto)
  items!: CreateSubscriptionItemDto[];
}
