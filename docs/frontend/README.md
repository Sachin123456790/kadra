# Angainor Frontend

Institutional-grade dashboard for the Angainor real estate fund platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Build | Vite 5 |
| Language | TypeScript |
| UI Framework | React 18 |
| Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Data Fetching | TanStack React Query |

## Project Structure

```
frontend/src/
  config/
    constants.ts            # Single config file (API URL, auth keys, query keys, routes)
  services/
    api-client.ts           # GET/POST/upload wrappers with 401 interceptor
    fund.service.ts         # Fund overview, waterfall config
    investors.service.ts    # Investor listing
    subscriptions.service.ts # Subscription CRUD
    settlements.service.ts  # Payment validation, settlement confirmation
    tokenization.service.ts # Token minting, transfers
    ownership.service.ts    # Cap table, ownership history
    distribution.service.ts # Distribution preview, execution
    documents.service.ts    # LPA upload, document hashes, parse status
    audit.service.ts        # Audit export creation and retrieval
    index.ts                # Barrel export
  hooks/
    useAuth.ts              # Auth context + useAuth() hook
    use-mobile.tsx          # Mobile breakpoint detection
    use-toast.ts            # Toast notification hook
  components/
    angainor/
      AppLayout.tsx         # Shell: top bar + sidebar + main content
      AuthProvider.tsx       # Auth state (localStorage), 401 auto-logout
      AuthGuard.tsx          # Route guard + withAuth() HOC
      DataTable.tsx          # Generic typed data table
      MetricCard.tsx         # KPI metric display card
      PageHeader.tsx         # Page title + subtitle
      SectionCard.tsx        # Content section wrapper
      StatusBadge.tsx        # Status chip (Verified, Pending, etc.)
      ErrorAlert.tsx         # Error display component
      EmptyState.tsx         # Empty data placeholder
      AngainorTabs.tsx          # Tab navigation component
    ui/                     # shadcn/ui primitives (40+ components)
  pages/
    LoginPage.tsx           # Demo login (accepts any credentials)
    FundOverview.tsx         # Fund dashboard with metrics
    InvestorsPage.tsx        # Investor listing + verification status
    SubscriptionsPage.tsx    # Subscription management
    SettlementPage.tsx       # Payment validation + settlement confirmation
    TransfersPage.tsx        # Transfer history (failed + successful)
    CapTablePage.tsx         # Live cap table
    DistributionPage.tsx     # Waterfall config + distribution preview
    AuditPage.tsx            # Audit exports
    NotFound.tsx             # 404 page
  data/
    mockData.ts             # Mock data (being replaced by API services)
  lib/
    utils.ts                # Tailwind cn() merge utility
```

## Getting Started

```sh
cd frontend
npm install
npm run dev
```

Dev server runs at `http://localhost:8080` with API proxy to `http://localhost:3000`.

## Environment Variables

Only one optional variable:

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `/api/v1` | Backend API base URL. In dev, Vite proxies `/api/v1` to the backend automatically. |

No `.env` file is needed for local development — the Vite proxy handles routing.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (port 8080) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Design Principles

- **Institutional banking aesthetic** — clean, professional UI. No crypto/web3 styling.
- **Dark sidebar + light content** — standard enterprise dashboard pattern.
- **No unnecessary dependencies** — plain `fetch` for API calls, no axios.
- **Type safety** — all API responses have TypeScript interfaces matching the backend exactly.
