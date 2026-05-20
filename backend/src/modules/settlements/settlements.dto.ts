import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

export class UploadPaymentEvidenceDto {
  @IsString()
  documentId: string;

  @IsOptional()
  @IsString()
  documentHashId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class OverrideSettlementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class ApproveSettlementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
