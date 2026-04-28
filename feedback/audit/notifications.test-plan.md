# Notifications Navigation — Test Plan

Scope: verify that notifications route to the correct destination, highlight the correct row, mark as read on click, and respect role boundaries + `prefers-reduced-motion`.

Files under test:
- `frontend/src/hooks/useNotifications.ts`
- `frontend/src/hooks/useHighlightRow.ts`
- `frontend/src/components/angainor/AppLayout.tsx` (dropdown)
- `frontend/src/pages/NotificationsPage.tsx`
- `frontend/src/pages/SubscriptionsPage.tsx`
- `frontend/src/pages/TransfersPage.tsx`
- `frontend/src/pages/InvestorTransfers.tsx`

---

## 1. Route resolution — `getNotificationRoute`

Unit tests (Vitest / Jest).

| Input kind | Role | Expected route |
|---|---|---|
| settlement | admin | `/settlement?highlight=<id>` |
| subscription | admin | `/subscriptions?highlight=<id>` |
| transfer | admin | `/transfers?highlight=<id>` |
| transfer_notice | admin | `/transfers?highlight=<id>` |
| mint | admin | `/cap-table?highlight=<id>` |
| general | admin | `/dashboard` (no highlight) |
| settlement | investor | `/investor/capital-account?highlight=<id>` |
| subscription | investor | `/investor?highlight=<id>` |
| transfer | investor | `/investor/transfers?highlight=<id>` |
| transfer_notice | investor | `/investor/transfers?highlight=<id>` |
| mint | investor | `/investor/capital-account?highlight=<id>` |
| general | investor | `/investor` (no highlight) |

Additional:
- When `targetId` is omitted, route must NOT contain `?highlight=`.
- `targetId` containing special chars is URI-encoded.

## 2. Notification builders — `useNotifications`

Use `@testing-library/react-hooks` (or RTL `renderHook`) with a mock QueryClient.

- **Admin SETTLED subscription** emits `type: 'settlement'`, `targetId === subscriptionId`, `targetRoute` ends with `/settlement?highlight=<subscriptionId>`.
- **Admin PENDING subscription** emits `type: 'subscription'`, `targetId === subscriptionId`.
- **Admin TRANSFER ownership event** with `status !== BLOCKED/FAILED` emits `type: 'transfer'`.
- **Admin TRANSFER ownership event** with `status === BLOCKED` emits `type: 'transfer_notice'`.
- **Admin MINT ownership event** emits `type: 'mint'`.
- **Investor my-settlement** emits when `sub.status === 'SETTLED'` with `settledAt`.
- **Investor my-sub** always emitted per subscription.
- **Investor my-transfer** emitted per transfer with `targetId === tx.id`.
- Notifications sorted by timestamp descending.
- `unreadCount` excludes items whose id is in `localStorage[angainor_read_notifications]`.

## 3. AppLayout dropdown

RTL component tests (render within `MemoryRouter`).

- Clicking a dropdown notification item calls `markAsRead(id)` then `navigate(targetRoute)`.
- Pressing **Enter** on a focused notification triggers same flow (verify `preventDefault`).
- Pressing **Space** on a focused notification triggers same flow.
- The unread dot disappears after interaction (dropdown re-renders from `useNotifications`).
- "View all notifications" row navigates to `/notifications`.

## 4. NotificationsPage

- Each row is a `<button>` with visible focus state: test `:focus-visible` classes render (`ring-2 ring-indigo-600`).
- Clicking a row invokes `handleOpen` which calls `markAsRead` + `navigate`.
- `Mark all as read` action zeros `unreadCount` on next render.
- Filter buttons restrict rendered items to the selected kind.

## 5. Highlight + scroll — `useHighlightRow`

JSDOM tests (mock `IntersectionObserver` and `scrollIntoView`).

- With no `?highlight` in URL, `highlightId === null`, `isPulsing === false`, and `scrollIntoView` is never called.
- With `?highlight=abc` and a mounted `[data-highlight-id="abc"]`, `scrollIntoView` is called with `behavior: 'smooth'` and `block: 'center'`; `isPulsing` becomes `true`, then `false` after 2000ms (use fake timers).
- With `prefers-reduced-motion: reduce`, `scrollIntoView` is called with `behavior: 'auto'` and `isPulsing` stays `false`.
- If the target DOM node is not mounted yet, the hook retries up to 20 times at 100ms intervals (verify with fake timers + deferred mount).
- Cleanup: if effect unmounts during the retry loop, `setIsPulsing` is not called (cancelled flag respected).

## 6. Destination page integration

E2E (Playwright) with a seeded demo account.

- **Admin — subscription**: Bell → click a "subscription created" notification → lands on `/subscriptions?highlight=<subId>` → row has `bg-indigo-50` + `animate-pulse` for ~2s → scrolls into view.
- **Admin — transfer (known limitation)**: Bell → click a transfer notification → lands on `/transfers?highlight=<eventId>` → NO row is highlighted (documented TODO; assert absence is expected current behavior).
- **Investor — settlement**: Bell → click `my-settlement-*` → lands on `/investor/capital-account?highlight=<subId>`. (Currently page is NOT wired — expect no highlight; track as follow-up.)
- **Investor — transfer**: Bell → click `my-transfer-*` → lands on `/investor/transfers?highlight=<txId>` → row is highlighted + pulses.

## 7. Accessibility

- Dropdown notification items are reachable by keyboard (Tab focus + visible focus ring from DropdownMenu primitive).
- NotificationsPage rows have `focus-visible:ring-2` and a non-hidden focus outline.
- `prefers-reduced-motion` disables both the 2s pulse (verified in `useHighlightRow` test) and respects `motion-reduce:animate-none` on `<main>`.

## 8. Unknown-kind fallback

- Construct an `AppNotification` with an unexpected `type` (cast) → `getNotificationRoute` returns role home (`/dashboard` or `/investor`).
- NotificationsPage still renders (no crash); icon map falls back — **open item**: `typeIcons`/`typeColors` do NOT include `transfer_notice` key, so a `transfer_notice` notification will access `undefined` and crash on `.icon`. Add a fallback or map `transfer_notice` explicitly. _(Flag as issue for the implementer.)_

## 9. Side-effects regression

- Verify pages that were NOT wired still behave as before:
  - `SettlementPage`, `CapTablePage`, `DocumentsPage`, `InvestorDocuments`, `InvestorCapitalAccount`, `InvestorDashboard` render without error when navigated to with `?highlight=<id>` present.
  - No console warnings from unused `highlightId`.

## 10. Type safety

- `npx tsc --noEmit` passes with 0 errors (verified locally during audit).
