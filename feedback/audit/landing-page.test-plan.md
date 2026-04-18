# Landing Page Clutter-Fix Audit — Playwright Test Plan

Target route: `/` (public landing)
Scope: verifies the 10 clutter-reduction requirements delivered in the recent LandingPage.tsx rework.

These assertions are documentation for a future E2E run. They are not wired into
a runner yet (no marketing-page Playwright harness exists in-repo at time of
writing). Each block maps to one requirement.

```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
});

// ── R1 — Eyebrow dedup ──────────────────────────────────────────────
test('R1 eyebrow dedup — only hero + closing carry the white/45 uppercase eyebrow', async ({ page }) => {
  // Hero eyebrow present
  await expect(page.getByText('Fund-Native Operating Infrastructure')).toBeVisible();
  // Closing eyebrow present (Angainor wordmark eyebrow)
  await expect(page.locator('section').filter({ hasText: 'The infrastructure revolutionizing fund operations.' })
    .getByText(/^Angainor$/)).toBeVisible();

  // Removed eyebrows — none of these strings should appear as eyebrow chips anywhere
  await expect(page.getByText('CURRENT SYSTEM', { exact: false })).toHaveCount(0);
  await expect(page.getByText('THE SOLUTION', { exact: false })).toHaveCount(0);
  await expect(page.getByText('WORKFLOWS', { exact: false })).toHaveCount(0);
  await expect(page.getByText('AUDIT & COMPLIANCE', { exact: false })).toHaveCount(0);

  // Privacy section retains exactly one eyebrow (sticky rail)
  const privacyEyebrow = page.getByText('Privacy and control', { exact: true });
  await expect(privacyEyebrow).toHaveCount(1);
});

// ── R2 — Grid/radial glow dedup ─────────────────────────────────────
test('R2 grid background only on hero', async ({ page }) => {
  // Hero has the linear-gradient grid backgroundImage
  const heroGrids = await page.locator('section >> div[aria-hidden]').filter({
    has: page.locator('css=[style*="linear-gradient"]'),
  }).count();
  expect(heroGrids).toBeGreaterThanOrEqual(1);

  // ProblemMockup container — no 56px grid
  const problemMockup = page.locator('section').nth(1);
  await expect(problemMockup).not.toContainText('56px 56px');

  // AuditCompliance 3-step panel — no grid backgroundImage
  const auditPanel = page.locator('section').filter({ hasText: 'Audit support should not start with reconstruction.' });
  await expect(auditPanel.locator('[style*="56px"]')).toHaveCount(0);
});

// ── R3 — WorkflowCoverage consolidated single list + auto-advance ────
test('R3 workflow list is single, auto-advances, pauses on hover/focus', async ({ page }) => {
  const list = page.locator('section').filter({ hasText: 'One operating layer across the fund lifecycle.' }).locator('ul');
  await expect(list).toHaveCount(1);
  const items = list.locator('li');
  await expect(items).toHaveCount(8);

  // auto-advance: wait 3s, first item should no longer be the only active (text-white) one
  const activeBefore = await items.filter({ has: page.locator('span.text-white') }).first().innerText();
  await page.waitForTimeout(3000);
  const activeAfter = await items.filter({ has: page.locator('span.text-white') }).first().innerText();
  expect(activeAfter).not.toEqual(activeBefore);

  // pause on hover
  await list.hover();
  const paused = await items.filter({ has: page.locator('span.text-white') }).first().innerText();
  await page.waitForTimeout(3500);
  const stillPaused = await items.filter({ has: page.locator('span.text-white') }).first().innerText();
  expect(stillPaused).toEqual(paused);
});

// ── R4 — Privacy section cut to 3 panels ─────────────────────────────
test('R4 privacy right column shows exactly 3 mock panels', async ({ page }) => {
  const privacy = page.locator('section').filter({ hasText: 'Selective visibility,' });
  const rightPanels = privacy.locator('.md\\:col-span-7 > div');
  await expect(rightPanels).toHaveCount(3);
  await expect(privacy.getByText('Other participants')).toBeVisible();
  await expect(privacy.getByText('Controlled storage')).toBeVisible();
  await expect(privacy.getByText('Anchored record')).toBeVisible();

  // Ensure the old GP/LP duplicate-grid + summary strip are gone
  await expect(privacy.getByText('GP view', { exact: false })).toHaveCount(0);
  await expect(privacy.getByText('LP view', { exact: false })).toHaveCount(0);
});

// ── R5 — Italic-serif dedup ──────────────────────────────────────────
test('R5 italic-serif span only in hero and closing headlines', async ({ page }) => {
  const italics = page.locator('h1 span.italic, h2 span.italic, h3 span.italic, h4 span.italic');
  // Hero = 1, Closing = 1
  await expect(italics).toHaveCount(2);
  await expect(italics.nth(0)).toContainText('into one deterministic system of record.');
  await expect(italics.nth(1)).toContainText('The infrastructure revolutionizing fund operations.');
});

// ── R6 — Hero normalization ──────────────────────────────────────────
test('R6 hero has no Canton pill, single subtitle, DLT caption muted', async ({ page }) => {
  const hero = page.locator('section').first();
  await expect(hero.getByText('Built on the Canton Network')).toHaveCount(0);
  // only one paragraph of subtitle body text (the short one)
  const heroParas = hero.locator('p');
  // 1 eyebrow + 1 subtitle = 2 <p> in hero
  await expect(heroParas).toHaveCount(2);
  // DLT statement not in hero (moved to small caption above footer)
  await expect(hero.getByText(/distributed ledger technology/i)).toHaveCount(0);
  // DLT caption present but small caps / muted
  const dlt = page.getByText(/distributed ledger technology/i);
  await expect(dlt).toBeVisible();
  const cls = await dlt.getAttribute('class');
  expect(cls).toMatch(/text-\[11px\]/);
  expect(cls).toMatch(/text-white\/35/);
});

// ── R7 — Footer: no dead href="#" links ──────────────────────────────
test('R7 footer has no href="#"', async ({ page }) => {
  const dead = page.locator('footer a[href="#"]');
  await expect(dead).toHaveCount(0);
});

// ── R8 — Inline <style> tag removed; font classes in index.css ───────
test('R8 no inline style tag in landing, font classes apply globally', async ({ page }) => {
  const html = await page.content();
  expect(html).not.toMatch(/<style>[^<]*font-family/i);
  // Fraunces class still renders: compute style on a .font-serif
  const serif = page.locator('.font-serif').first();
  const family = await serif.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family.toLowerCase()).toContain('fraunces');
});

// ── R9 — Pill normalization ──────────────────────────────────────────
test('R9 labels Reconstructed / Canonical / CONTROLLED ACCESS are plain small-caps', async ({ page }) => {
  // RECONSTRUCTED lives inside SVG as <text>, no rounded-full pill chip
  const problemSvg = page.locator('svg[aria-label*="reconstructed"]').first();
  await expect(problemSvg).toContainText('RECONSTRUCTED');

  // Canonical label is a span, not a pill (no rounded-full)
  const canonical = page.getByText('Canonical', { exact: true });
  const canonicalCls = await canonical.getAttribute('class');
  expect(canonicalCls ?? '').not.toMatch(/rounded-full/);

  // Status pills kept: ANCHORED, PRIVATE should still be pill-shaped
  const anchored = page.getByText('ANCHORED').first();
  const anchoredCls = await anchored.getAttribute('class');
  expect(anchoredCls ?? '').toMatch(/rounded-full/);
});

// ── R10 — prefers-reduced-motion guard present ───────────────────────
test('R10 reduced-motion emulation kills ang-* animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const svgPath = page.locator('path[stroke-dasharray="4 4"]').first();
  const animation = await svgPath.evaluate((el) => getComputedStyle(el).animationName);
  expect(['none', '']).toContain(animation);
});
```

## Notes for the future runner
- The site is a single SPA; `<section>` ordering is stable per `LandingPage.tsx` `<main>`.
- Auto-advance interval is 2800ms — the 3000ms wait in R3 is intentional padding.
- The reduced-motion assertion relies on the global `@media (prefers-reduced-motion: reduce)` block in `frontend/src/index.css` lines 239-245.
