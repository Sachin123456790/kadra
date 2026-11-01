import { fail } from './types';

export const TAXONOMY_VERSION = 'angainor-terms-2';
// Versioned from taxonomy-1.txt. Source wording and executable parameters remain separate.
export const taxonomy: Record<string, 'rate' | 'days' | 'text' | 'list'> = {
  'economics.preferred_return_rate': 'rate',
  'economics.preferred_return_compounding': 'text',
  'economics.carried_interest_rate': 'rate',
  'economics.gp_catchup_rate': 'rate',
  'economics.gp_catchup_mechanics': 'text',
  'economics.residual_split_lp': 'rate',
  'economics.residual_split_gp': 'rate',
  'economics.return_of_capital_priority': 'text',
  'economics.distribution_tiers': 'list',
  'economics.reserves_withholding': 'text',
  'lp_terms.investor_rights': 'list',
  'controls.required_approvers': 'text',
  'controls.consent_threshold': 'text',
  'controls.notice_period_days': 'days',
  'controls.valuation_date': 'text',
  'operations.currency': 'text',
  'operations.fiscal_period': 'text',
  'operations.distribution_date_rules': 'text',
  'operations.payment_method': 'text',
  'hierarchy.document_type': 'text',
  'hierarchy.effective_date': 'text',
  'hierarchy.amendment_target': 'text',
  'hierarchy.superseded_clauses': 'list',
  'hierarchy.precedence_rule': 'text',
  'capital_calls.allocation_basis': 'text',
  'capital_calls.permitted_purposes': 'list',
  'capital_calls.notice_period_days': 'days',
  'capital_calls.notice_day_basis': 'text',
  'capital_calls.excused_purposes': 'list',
  'capital_calls.redistribution': 'text',
  'capital_calls.recallable_capital': 'text',
  'capital_calls.required_approvers': 'text',
};
export function validateTerm(key: string, value: any) {
  const type = taxonomy[key];
  if (!type)
    fail(422, 'UNKNOWN_TERM', 'This term is outside the versioned taxonomy.');
  if (
    type === 'rate' &&
    (typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 1)
  )
    fail(
      422,
      'INVALID_RATE',
      'Rates must be decimal fractions between 0 and 1.',
    );
  if (
    type === 'days' &&
    (!Number.isSafeInteger(value) || value < 0 || value > 365)
  )
    fail(422, 'INVALID_DAYS', 'Notice days must be an integer from 0 to 365.');
  if (
    type === 'text' &&
    (typeof value !== 'string' || !value.trim() || value.length > 4000)
  )
    fail(422, 'INVALID_TERM', 'A nonempty text value is required.');
  if (
    type === 'list' &&
    (!Array.isArray(value) ||
      value.length > 50 ||
      value.some((v) => typeof v !== 'string' || v.length > 2000))
  )
    fail(422, 'INVALID_TERM', 'Use an array of up to 50 text values.');
  return value;
}

// Conservative, visible suggestions only. Missing language is never assigned a market default.
export function suggestTerms(sources: Array<{ id: string; text: string }>) {
  const rules: Array<[string, RegExp, (m: RegExpMatchArray) => any]> = [
    [
      'economics.preferred_return_rate',
      /preferred return[^\n%]{0,45}?(\d+(?:\.\d+)?)\s*%/i,
      (m) => Number(m[1]) / 100,
    ],
    [
      'economics.carried_interest_rate',
      /carried interest[^\n%]{0,35}?(\d+(?:\.\d+)?)\s*%/i,
      (m) => Number(m[1]) / 100,
    ],
    [
      'capital_calls.notice_period_days',
      /capital call[^\n]{0,60}?(\d+)\s+(?:business|calendar)\s+days/i,
      (m) => Number(m[1]),
    ],
    [
      'capital_calls.notice_day_basis',
      /capital call[^\n]{0,60}?\d+\s+(business|calendar)\s+days/i,
      (m) => m[1].toLowerCase(),
    ],
    ['operations.currency', /\b(USD)\b/, (m) => m[1]],
  ];
  return Object.keys(taxonomy).flatMap<{
    key: string;
    value: any;
    sourceId: string | null;
    state: string;
  }>((key) => {
    const definition = rules.find((r) => r[0] === key);
    const matches = definition
      ? sources.flatMap((source) => {
          const match = source.text.match(definition[1]);
          return match
            ? [
                {
                  key,
                  value: definition[2](match),
                  sourceId: source.id,
                  state: 'UNREVIEWED',
                },
              ]
            : [];
        })
      : [];
    return matches.length
      ? matches
      : [{ key, value: null, sourceId: null, state: 'NOT_EXTRACTED' }];
  });
}
