import { Injectable } from '@nestjs/common';
import { DocumentParserAdapter, ExtractedField } from './parser.adapter';

@Injectable()
export class MockParserAdapter implements DocumentParserAdapter {
  async parse(data: Buffer, documentType: string): Promise<ExtractedField[]> {
    // Mock extraction returning deterministic fields for demo
    return [
      { fieldName: 'fund_name', fieldValueText: 'Kadra Demo Fund I', confidence: 0.98, sourcePage: 1 },
      { fieldName: 'legal_form', fieldValueText: 'Limited Partnership', confidence: 0.95, sourcePage: 1 },
      { fieldName: 'total_commitment', fieldValueNumeric: 5000000, confidence: 0.92, sourcePage: 2 },
      { fieldName: 'lp_count', fieldValueNumeric: 5, confidence: 0.97, sourcePage: 2 },
      { fieldName: 'allocation_per_lp', fieldValueNumeric: 20, confidence: 0.96, sourcePage: 3 },
      { fieldName: 'preferred_return', fieldValueNumeric: 8, confidence: 0.94, sourcePage: 4 },
      { fieldName: 'gp_promote', fieldValueNumeric: 20, confidence: 0.93, sourcePage: 4 },
      { fieldName: 'jurisdiction', fieldValueText: 'Delaware', confidence: 0.99, sourcePage: 1 },
    ];
  }
}
