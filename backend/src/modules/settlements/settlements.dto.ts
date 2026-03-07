import { IsString, IsOptional } from 'class-validator';

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
  reason: string;
}
