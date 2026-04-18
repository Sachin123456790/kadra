# Preview Tax Package — Test Plan

File under test: `frontend/src/pages/InvestorDocuments.tsx`

Scope: the Preview Tax Package primary action, its secondary Download
button, and the accessibility of the preview dialog.

## Test list

```ts
test('primary button reads "Preview Tax Package"');
test('secondary button reads "Download"');
test('primary click opens modal');
test('modal closes on Escape key');
test('modal closes on backdrop click');
test('modal closes on X button');
test('aria-busy + aria-live announce loading state');
test('focus returns to primary button after close');
```

## Notes / setup

- Render `<InvestorDocuments />` inside a `QueryClientProvider` + `MemoryRouter`.
- Stub `getInvestorDocuments` to resolve with an empty list so the page
  reaches the actions rendered in `PageHeader`.
- The preview flow uses a 400ms `setTimeout` before opening the modal;
  use `vi.useFakeTimers()` (or `jest.useFakeTimers()`) and advance by
  `400` after clicking Preview.

## Per-test expectations

1. **primary button reads "Preview Tax Package"**
   - `screen.getByRole('button', { name: /preview tax package/i })` exists.
   - It contains an `Eye` icon (assert `svg` inside button).
2. **secondary button reads "Download"**
   - `screen.getByRole('button', { name: /^download$/i })` exists in the
     PageHeader action region.
3. **primary click opens modal**
   - Click Preview, advance timers by 400ms.
   - Dialog with `role="dialog"` and `aria-modal="true"` is visible and
     labelled by "Tax Package Preview".
4. **modal closes on Escape key**
   - Open modal (as above), `fireEvent.keyDown(document, { key: 'Escape' })`.
   - Dialog is removed from the DOM.
5. **modal closes on backdrop click**
   - Open modal, click the backdrop (the outer dialog container, NOT the
     inner panel). Dialog is removed.
6. **modal closes on X button**
   - Open modal, click the button with `aria-label="Close preview"`.
     Dialog is removed.
7. **aria-busy + aria-live announce loading state**
   - Before advancing timers, the Preview button has `aria-busy="true"`
     and the sr-only `aria-live="polite"` region reads "Generating preview…".
   - After timers flush and modal opens, `aria-busy` becomes `"false"`
     and the live region is empty.
8. **focus returns to primary button after close**
   - Open modal (focus moves off the trigger), close via Escape.
   - `document.activeElement` equals the Preview Tax Package button.

## Follow-ups (not covered here)

- Backend endpoint `GET /investor/me/tax-package/preview` is not yet
  implemented; once it exists, replace the placeholder body with an
  iframe and add a network-level test.
- Focus trap inside the dialog (Tab cycling) is not implemented. This
  is a known, non-blocking accessibility follow-up.
