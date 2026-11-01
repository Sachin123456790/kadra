import Decimal from 'decimal.js';
import { fail, Rule } from './types';
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export function money(value: unknown, allowZero = false): string {
  if (typeof value !== 'string' || !/^\d{1,15}(\.\d{1,2})?$/.test(value))
    fail(
      422,
      'INVALID_AMOUNT',
      'Use a positive decimal amount with at most two decimal places.',
    );
  const d = new Decimal(value as string);
  if (d.lt(0) || (!allowZero && d.eq(0)))
    fail(422, 'INVALID_AMOUNT', 'Amount must be positive.');
  return d.toFixed(2);
}
export function applicable(
  rules: Rule[],
  key: string,
  asOf: string,
  investorId?: string,
): Rule | undefined {
  const scoped = rules.filter(
    (r) =>
      r.key === key &&
      r.effectiveFrom <= asOf &&
      (!r.investorId || r.investorId === investorId),
  );
  return scoped.sort(
    (a, b) =>
      Number(!!b.investorId) - Number(!!a.investorId) ||
      b.effectiveFrom.localeCompare(a.effectiveFrom),
  )[0];
}
export function allocate(
  amount: string,
  investors: Array<{
    id: string;
    name: string;
    status?: string;
    commitment: string;
    funded: string;
    reserved: string;
  }>,
  rules: Rule[],
  purpose: string,
  asOf: string,
  dueDate: string,
) {
  const checks: Array<{
    code: string;
    result: string;
    message: string;
    investorId?: string;
  }> = [];
  const check = (
    code: string,
    ok: boolean,
    message: string,
    investorId?: string,
  ) => checks.push({ code, result: ok ? 'PASS' : 'FAIL', message, investorId });
  const rule = (key: string, investor?: string) =>
    applicable(rules, key, asOf, investor);
  check(
    'ALLOCATION_BASIS',
    rule('capital_calls.allocation_basis')?.value === 'commitment',
    'A reviewed commitment-based allocation rule is required.',
  );
  const purposes = rule('capital_calls.permitted_purposes')?.value;
  check(
    'PERMITTED_PURPOSE',
    Array.isArray(purposes) && purposes.includes(purpose),
    'Purpose must be permitted by the reviewed rules.',
  );
  check(
    'RECALLABLE_CAPITAL',
    rule('capital_calls.recallable_capital')?.value === 'none',
    'This engine supports non-recallable contributions only.',
  );
  check(
    'APPROVERS',
    rule('capital_calls.required_approvers')?.value === 'fund_approver',
    'A reviewed mapping to the fund approver role is required.',
  );
  const requested = new Decimal(amount);
  const rows = investors.map((investor) => {
    check(
      'INVESTOR_STATUS',
      investor.status !== 'INACTIVE',
      'Inactive commitments need a reviewed treatment before a call can be approved.',
      investor.id,
    );
    const excused =
      rule('capital_calls.excused_purposes', investor.id)?.value?.includes(
        purpose,
      ) === true;
    const basis = new Decimal(excused ? 0 : investor.commitment);
    const available = Decimal.max(
      0,
      new Decimal(investor.commitment)
        .minus(investor.funded)
        .minus(investor.reserved),
    );
    const days = rule('capital_calls.notice_period_days', investor.id)?.value;
    const dayBasis = rule('capital_calls.notice_day_basis', investor.id)?.value;
    // Calendar-day arithmetic is supported exactly. Business calendars require a reviewed calendar.
    const elapsed = (Date.parse(dueDate) - Date.parse(asOf)) / 86400000;
    if (!excused)
      check(
        'NOTICE_PERIOD',
        Number.isInteger(days) && dayBasis === 'calendar' && elapsed >= days,
        'Notice period must meet the reviewed calendar-day rule. Business-day calendars are not yet supported.',
        investor.id,
      );
    return {
      ...investor,
      excused,
      basis,
      available,
      amount: new Decimal(0),
      remainder: new Decimal(0),
    };
  });
  check(
    'ELIGIBLE_INVESTORS',
    rows.some((r) => r.basis.gt(0)),
    'At least one eligible commitment is required.',
  );
  if (rows.some((r) => r.excused))
    check(
      'EXCUSE_REDISTRIBUTION',
      rule('capital_calls.redistribution')?.value === 'pro_rata_eligible',
      'Redistribution requires explicit authority.',
    );
  const totalBasis = rows.reduce((n, r) => n.plus(r.basis), new Decimal(0));
  if (totalBasis.gt(0)) {
    for (const row of rows) {
      const rawCents = requested.times(100).times(row.basis).div(totalBasis);
      row.amount = rawCents.floor().div(100);
      row.remainder = rawCents.minus(rawCents.floor());
    }
    let cents = requested
      .minus(rows.reduce((n, r) => n.plus(r.amount), new Decimal(0)))
      .times(100)
      .toNumber();
    const ordered = [...rows]
      .filter((r) => r.basis.gt(0))
      .sort((a, b) => b.remainder.cmp(a.remainder) || a.id.localeCompare(b.id));
    for (let i = 0; i < cents; i++)
      ordered[i % ordered.length].amount =
        ordered[i % ordered.length].amount.plus('0.01');
  }
  for (const row of rows)
    check(
      'COMMITMENT_CAPACITY',
      row.amount.lte(row.available),
      'Allocation cannot exceed remaining commitment after contributions and approved outstanding calls.',
      row.id,
    );
  const total = rows.reduce((n, r) => n.plus(r.amount), new Decimal(0));
  check(
    'ALLOCATION_TOTAL',
    total.eq(requested),
    'Investor allocations must sum exactly to the requested amount.',
  );
  return {
    engineVersion: 'capital-calls-1',
    checks,
    total: total.toFixed(2),
    allocations: rows.map((r) => ({
      investorId: r.id,
      name: r.name,
      commitment: r.commitment,
      funded: r.funded,
      reserved: r.reserved,
      available: r.available.toFixed(2),
      amount: r.amount.toFixed(2),
      excused: r.excused,
      basis: r.basis.toFixed(2),
    })),
  };
}

export function distributionPreview(
  amount: string,
  contributions: Array<{ investorId: string; amount: string; date: string }>,
  asOf: string,
  rules: Rule[],
) {
  const pref = applicable(rules, 'economics.preferred_return_rate', asOf);
  const lp = applicable(rules, 'economics.residual_split_lp', asOf);
  const gp = applicable(rules, 'economics.residual_split_gp', asOf);
  const compounding = applicable(
    rules,
    'economics.preferred_return_compounding',
    asOf,
  );
  if (
    !pref ||
    !lp ||
    !gp ||
    compounding?.value !== 'simple_actual_365' ||
    !new Decimal(lp.value).plus(gp.value).eq(1)
  )
    fail(
      422,
      'UNSUPPORTED_WATERFALL',
      'This scenario requires reviewed simple Actual/365 preferred return and LP/GP residual splits totaling 1.',
    );
  if (
    applicable(rules, 'economics.gp_catchup_rate', asOf)?.value !== 0 ||
    applicable(rules, 'economics.return_of_capital_priority', asOf)?.value !==
      'all_contributed_capital_first'
  )
    fail(
      422,
      'UNSUPPORTED_WATERFALL',
      'Only return of all capital, simple preferred return, no catch-up, and residual split is supported.',
    );
  const capital = contributions.reduce(
    (n, c) => n.plus(c.amount),
    new Decimal(0),
  );
  const accrued = contributions.reduce(
    (n, c) =>
      n.plus(
        new Decimal(c.amount)
          .times(pref.value)
          .times(
            Math.max(0, (Date.parse(asOf) - Date.parse(c.date)) / 86400000),
          )
          .div(365),
      ),
    new Decimal(0),
  );
  const roc = Decimal.min(amount, capital);
  const remaining = new Decimal(amount).minus(roc);
  const preferred = Decimal.min(remaining, accrued).toDecimalPlaces(2);
  const residual = remaining.minus(preferred);
  const gpResidual = residual.times(gp.value).toDecimalPlaces(2);
  return {
    engineVersion: 'scenario-1',
    simulated: true,
    assumption:
      'First distribution only; no fees, reserves, catch-up, recycling or prior distributions. Simple Actual/365.',
    returnOfCapital: roc.toFixed(2),
    preferredReturn: preferred.toFixed(2),
    lpResidual: residual.minus(gpResidual).toFixed(2),
    gpResidual: gpResidual.toFixed(2),
    total: new Decimal(amount).toFixed(2),
  };
}
