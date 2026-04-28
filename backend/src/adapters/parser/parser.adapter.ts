export interface ExtractedField {
  fieldName: string;
  fieldValueText?: string;
  fieldValueNumeric?: number;
  sourcePage?: number;
}

export interface DocumentParserAdapter {
  parse(data: Buffer, documentType: string): Promise<ExtractedField[]>;
}

export const PARSER_ADAPTER = 'PARSER_ADAPTER';
