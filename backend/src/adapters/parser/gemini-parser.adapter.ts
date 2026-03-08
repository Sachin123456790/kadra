import { Injectable } from '@nestjs/common';
import { ExternalDependencyError, ValidationError } from '../../common/errors';
import { DocumentParserAdapter, ExtractedField } from './parser.adapter';

interface GeminiField {
  fieldName: string;
  fieldValueText?: string;
  fieldValueNumeric?: number;
  confidence?: number;
  sourcePage?: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

@Injectable()
export class GeminiParserAdapter implements DocumentParserAdapter {
  private readonly apiKey = process.env.GEMINI_API_KEY ?? '';
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';

  async parse(data: Buffer, documentType: string): Promise<ExtractedField[]> {
    if (!this.apiKey) {
      throw new ExternalDependencyError(
        'GeminiParser',
        'GEMINI_API_KEY is not configured',
      );
    }

    const prompt = [
      'You are a legal document extraction engine for institutional real estate funds.',
      `Document type: ${documentType}.`,
      'Extract important contract keywords/fields and return only strict JSON with this schema:',
      '{"fields":[{"fieldName":"string","fieldValueText":"string optional","fieldValueNumeric":0 optional,"confidence":0.0-1.0,"sourcePage":1 optional}]}',
      'Rules:',
      '1. Include useful normalized field names like fund_name, legal_form, committed_amount, allocation_pct, preferred_return, gp_promote, jurisdiction, investor_name, investor_wallet_address, subscription_ref, payment_reference.',
      '2. If numeric, use fieldValueNumeric.',
      '3. If uncertain still include field but lower confidence.',
      '4. Return valid JSON only. No markdown.',
    ].join('\n');

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: data.toString('base64'),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ExternalDependencyError(
        'GeminiParser',
        `Gemini request failed: ${response.status} ${text}`,
      );
    }

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new ValidationError('Gemini parser returned empty response');
    }

    let parsed: { fields?: GeminiField[] };
    try {
      parsed = JSON.parse(text) as { fields?: GeminiField[] };
    } catch {
      throw new ValidationError('Gemini parser returned invalid JSON');
    }

    const fields = (parsed.fields ?? [])
      .filter((f) => !!f.fieldName)
      .map((f) => ({
        fieldName: f.fieldName.trim(),
        fieldValueText: f.fieldValueText?.trim(),
        fieldValueNumeric:
          typeof f.fieldValueNumeric === 'number' ? f.fieldValueNumeric : undefined,
        confidence:
          typeof f.confidence === 'number'
            ? Math.max(0, Math.min(1, f.confidence))
            : 0.75,
        sourcePage:
          typeof f.sourcePage === 'number' && f.sourcePage > 0
            ? Math.floor(f.sourcePage)
            : undefined,
      }));

    if (fields.length === 0) {
      throw new ValidationError('No fields extracted from document');
    }

    return fields;
  }
}
