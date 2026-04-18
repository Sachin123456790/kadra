# DerivedAmount — Test Plan

## Component-level tests (`DerivedAmount.test.tsx`)

```
test('DerivedAmount renders amount with dotted-underline trigger');
  // assert trigger button has class 'border-b' and 'border-dotted'

test('opens on mouseenter, focus, and click');
  // fireEvent.mouseEnter(trigger) -> expect popover visible
  // fireEvent.focus(trigger)      -> expect popover visible
  // fireEvent.click(trigger)      -> Radix toggles open

test('closes on Escape and on click outside');
  // open, press Escape -> closed
  // open, click document body -> closed (Radix default)

test('popover has role=dialog or Radix equivalent');
  // Radix Popover.Content exposes role="dialog"; assert via getByRole('dialog')

test('steps column is right-aligned monospace');
  // each step value div has classes 'text-right', 'font-mono', 'tabular-nums'

test('result row is right-aligned monospace font-semibold');

test('sum(steps) === result for additive formulas');
  // passing steps with numeric values [10, 20, 30] and result=60,
  // assert rendered result matches sum

test('sourceRef.route renders a <Link> with correct to= value');
  // passing sourceRef.route='/subscriptions', assert anchor href matches

test('motion-reduce skips popover animation');
  // render with matchMedia('(prefers-reduced-motion: reduce)') mocked true
  // assert popover content has class 'motion-reduce:animate-none'

test('numeric values never truncate (max-w-sm with word-break)');
  // render 9-digit currency, assert full value present in DOM

test('sourceDocumentRef renders FileText link when route provided');
test('asOf renders formatted timestamp in footer');
test('aria-label falls back when label omitted');
```

## Per-page scenario tests

### `InvestorCapitalAccount.test.tsx`

```
test('closing balance derivation formula matches displayed label');
  // render with mock account, open derivation for 'Closing Balance',
  // expect 5 steps (initial+, pref+, residual+, capitalReturned-, distributions-)

test('sum of signed steps for closing balance equals displayed endingBalance');
  // With mocked account values: initial=100000, pref=8000, residual=2000,
  // capitalReturned=20000, distributions=5000 -> expected net 85000
  // assert endingBalance from backend matches signed sum ±0.01

test('initial contribution step links to /subscriptions');
test('accrued preferred return step shows 8% p.a. placeholder');
test('residual allocation has 80/20 carry note');
test('each StatementRow with derivation shows dotted-underline trigger');
```

### `InvestorDistributions.test.tsx`

```
test('preferred-return derivation renders prefRate from backend waterfallConfig');
  // breakdown.waterfallConfig.preferredReturnRate=7 -> popover shows '7%'
test('preferred-return falls back to 8% when backend rate missing');
test('gross amount derivation equals RoC + Pref + Residual');
  // residual = max(0, net - RoC - pref); gross must equal sum of three steps
test('net amount derivation equals gross - withholding');
test('promote step labels match tiers 3–4 definitions');
test('selecting a different distribution event updates the derivations');
```

### `CapTablePage.test.tsx`

```
test('ownership % derivation equals tokenBalance / totalSettledTokens * 100');
  // with settledTokens=2000, total=10000 -> 20%
  // assert popover result text == '20.00%'
test('wallet step exposes walletAddress truncated to 6…4');
test('capital-contributed derivation links to /subscriptions');
test('capital-contributed shows Settled vs Pending based on settledAt');
test('governing LPA footer link renders when governingHashHex present');
```

## Visual / a11y

```
test('popover contrast passes WCAG 2.1 AA on white bg');
test('popover max-width constrained to 22rem');
test('popover trigger is focusable via Tab');
test('Escape returns focus to trigger');
```
