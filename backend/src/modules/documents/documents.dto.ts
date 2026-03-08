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
  @Min(0)
  @Max(1)
  confidence?: number;

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
