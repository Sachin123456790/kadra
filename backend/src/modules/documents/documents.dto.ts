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

export class ManualExtractedFieldDto {
  @IsString()
  fieldName!: string;

  @IsOptional()
  @IsString()
  fieldValueText?: string;

  @IsOptional()
  @IsNumber()
  fieldValueNumeric?: number;

  @IsOptional()
  @IsNumber()
  sourcePage?: number;
}

export class AddManualExtractedFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualExtractedFieldDto)
  fields!: ManualExtractedFieldDto[];
}

export class ApproveDocumentSubscriptionItemDto {
  @IsString()
  investorId!: string;

  @IsString()
  walletId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  allocationPct!: number;

  @IsNumber()
  committedAmount!: number;
}

export class FieldUpdateDto {
  @IsString()
  fieldId!: string;

  @IsOptional()
  @IsString()
  fieldValueText?: string;

  @IsOptional()
  @IsNumber()
  fieldValueNumeric?: number;
}

export class UpdateExtractedFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldUpdateDto)
  fieldUpdates!: FieldUpdateDto[];
}

export class ApproveDocumentDto {
  @IsString()
  fundId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApproveDocumentSubscriptionItemDto)
  subscriptionItems!: ApproveDocumentSubscriptionItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldUpdateDto)
  fieldUpdates?: FieldUpdateDto[];
}
