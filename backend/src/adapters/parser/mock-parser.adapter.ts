import { Injectable } from '@nestjs/common';
import { DocumentParserAdapter, ExtractedField } from './parser.adapter';

@Injectable()
export class MockParserAdapter implements DocumentParserAdapter {
  async parse(data: Buffer, documentType: string): Promise<ExtractedField[]> {
    // Mock extraction returning deterministic fields for demo
    return [
      {
        fieldName: 'fund_name',
        fieldValueText: 'Angainor Demo Fund I',
        sourcePage: 1,
      },
      {
        fieldName: 'legal_form',
        fieldValueText: 'Limited Partnership',
        sourcePage: 1,
      },
      {
        fieldName: 'total_commitment',
        fieldValueNumeric: 5000000,
        sourcePage: 2,
      },
      {
        fieldName: 'lp_count',
        fieldValueNumeric: 5,
        sourcePage: 2,
      },
      {
        fieldName: 'allocation_per_lp',
        fieldValueNumeric: 20,
        sourcePage: 3,
      },
      {
        fieldName: 'preferred_return',
        fieldValueNumeric: 8,
        sourcePage: 4,
      },
      {
        fieldName: 'gp_promote',
        fieldValueNumeric: 20,
        sourcePage: 4,
      },
      {
        fieldName: 'jurisdiction',
        fieldValueText: 'Delaware',
        sourcePage: 1,
      },
    ];
  }
}
