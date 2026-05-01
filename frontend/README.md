# Angainor Frontend

Institutional-grade dashboard for the Angainor real estate fund platform.

## Tech Stack

- Vite + TypeScript
- React 18
- shadcn/ui + Radix UI
- Tailwind CSS
- React Router (public marketing + admin/investor product surfaces)
- TanStack React Query
- viem + EIP-6963 wallet detection (MetaMask, Phantom)
- pdfjs / md-editor for document viewers and notice editing

## Surfaces

| Route | Surface | Aesthetic |
|---|---|---|
| `/` | Public landing (marketing) | Dark Angainor brand (italic-serif hero, monospace markers) |
| `/privacy` | Privacy & Control notice | Dark Angainor brand |
| `/login` | Auth | Light institutional |
| `/dashboard`, `/investors`, `/settlement`, ... | Admin product | Light institutional banking |
| `/investor`, `/investor/distributions`, ... | Investor product | Light institutional banking |

The shared `#4338ca` indigo accent bridges both surfaces.

## Getting Started

```bash
npm install
npm run dev              # http://localhost:8080
```

The dev server expects the backend at `http://localhost:3000` (configure via `VITE_API_URL` in `.env.local`).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Key Pages

- **Admin**: FundOverview, CapTable, Distribution, Investors (KYC/accreditation + bulk CSV/XLSX import), Documents, Subscriptions, Settlement, Transfers, Audit & Exports.
- **Investor**: Dashboard, Capital Account, Documents, Distributions (with simulator), Transfers, Profile.
- **Shared**: Notifications, Profile, Help & Support.

## Design Principles

See `.impeccable.md` at the repo root for full design context. Highlights:

- Institutional banking aesthetic — Carta/Pulley, Stripe Dashboard, JP Morgan/Goldman as references; no crypto/Web3 visual language.
- Monospace tabular-nums for hashes and financial figures; never truncate dollar amounts.
- Hierarchy via size/weight/spacing; reserve color for semantic meaning.
- WCAG 2.1 AA accessibility (contrast, keyboard nav, `prefers-reduced-motion`).
- Illustrations: unDraw SVGs only, indigo `#4338ca` accent, no colored background wrappers.

## Production

Deployed to Vercel: https://frontend-nine-woad-28.vercel.app

See the repo root `README.md` for full architecture context.
