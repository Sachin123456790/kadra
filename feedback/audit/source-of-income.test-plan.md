# Source of Income Tooltip — Test Plan

Target: `frontend/src/pages/InvestorProfile.tsx` — `SourceOfIncomeLabel` component
Framework: React Testing Library + jest-axe + user-event (@testing-library/user-event v14)

Note: The surrounding project does not yet have RTL wired up for this page. The
cases below are executable-adjacent pseudocode the next implementer can lift
once the test harness is added.

## Setup

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InvestorProfilePage } from "@/pages/InvestorProfile";

expect.extend(toHaveNoViolations);

const VERBATIM_COPY =
  "Source of income identifies the origin of the capital you are investing. " +
  "This is collected for regulatory compliance (AML/KYC) \u2014 funds must verify " +
  "that contributed capital comes from legitimate sources such as employment, " +
  "business operations, investment returns, inheritance, or the sale of assets. " +
  "Your answer is shared only with the fund administrator for compliance review.";

function renderProfile() {
  return render(
    <TooltipProvider>
      <InvestorProfilePage />
    </TooltipProvider>
  );
}
```

## Cases

```ts
test("renders Source of Income label with info icon trigger", async () => {
  renderProfile();
  expect(screen.getByText("Source of Income")).toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: /about source of income/i });
  expect(trigger).toBeInTheDocument();
  // Icon is aria-hidden so it doesn't double-announce
  expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});

test("tooltip content matches verbatim compliance copy", async () => {
  const user = userEvent.setup();
  renderProfile();
  const trigger = screen.getByRole("button", { name: /about source of income/i });
  await user.hover(trigger);
  const tip = await screen.findByRole("tooltip");
  expect(tip).toHaveTextContent(VERBATIM_COPY);
});

test("tooltip opens on keyboard focus and closes on blur", async () => {
  const user = userEvent.setup();
  renderProfile();
  const trigger = screen.getByRole("button", { name: /about source of income/i });
  await user.tab(); // walk focus to the trigger (may require multiple tabs in real page)
  trigger.focus();
  await waitFor(() => expect(screen.getByRole("tooltip")).toBeVisible());
  trigger.blur();
  await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
});

test("tooltip closes on Escape", async () => {
  const user = userEvent.setup();
  renderProfile();
  const trigger = screen.getByRole("button", { name: /about source of income/i });
  trigger.focus();
  await screen.findByRole("tooltip");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
});

test("tooltip is associated via aria-describedby for screen readers", async () => {
  renderProfile();
  const trigger = screen.getByRole("button", { name: /about source of income/i });
  trigger.focus();
  const tip = await screen.findByRole("tooltip");
  // Radix Tooltip wires aria-describedby on the trigger to the content id
  expect(trigger).toHaveAttribute("aria-describedby", tip.id);
});

test("label has no duplicate occurrences anywhere on the page", () => {
  renderProfile();
  const matches = screen.getAllByText(/source of income/i);
  // Exactly one visible label; the aria-label on the trigger is accessible name,
  // not text content, so getAllByText should return 1.
  expect(matches).toHaveLength(1);
});

test("jest-axe: no a11y violations with tooltip open", async () => {
  const { container } = renderProfile();
  const trigger = screen.getByRole("button", { name: /about source of income/i });
  trigger.focus();
  await screen.findByRole("tooltip");
  expect(await axe(container)).toHaveNoViolations();
});
```

## Manual verification checklist (until automated tests land)

- [ ] Hover trigger: tooltip appears above the icon, wraps within `max-w-xs`.
- [ ] Tab to trigger: tooltip appears on focus, visible focus ring on icon button.
- [ ] Press Escape while focused: tooltip dismisses.
- [ ] Resize viewport to 320px: tooltip text wraps, does not clip horizontally.
- [ ] VoiceOver / NVDA: trigger announces as "About Source of Income, button",
      followed by the full verbatim paragraph via aria-describedby.
- [ ] No em-dash mojibake ("â€”") — the literal `\u2014` should render as `—`.
