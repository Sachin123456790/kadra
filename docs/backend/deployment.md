# Kadra MVP Deployment Guide

This document covers deploying the Kadra backend (NestJS + Fastify) to Vercel, provisioning Supabase, configuring cron jobs, and deploying the frontend.

---

## Vercel Backend Setup

### Prerequisites

- Vercel CLI installed: `npm i -g vercel`
- A Vercel account linked to the repository
- Node.js 20.x

### Configuration

- **Root directory in Vercel**: `backend`
- **Framework preset**: Other
- **Build command**: `cd backend && npm install && npm run build`
- **Output directory**: `backend/dist`
- **Node.js version**: 20.x

NestJS + Fastify requires the `@vercel/node` builder targeting `dist/src/main.js`. The `backend/vercel.json` file handles this routing:

```json
{
  "version": 2,
  "builds": [
    { "src": "dist/src/main.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "dist/src/main.js" }
  ]
}
```

### Deploy

```bash
cd backend
vercel --prod
```

---

## Required Environment Variables (Vercel)

Set these in the Vercel dashboard under Settings > Environment Variables.

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres connection string | `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres` |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC endpoint | `https://sepolia.base.org` |
| `CHAIN_ID` | Target chain ID | `84532` |
| `CHAIN_SIGNER_PRIVATE_KEY` | Demo signer private key (testnet only) | `0x...` |
| `TOKEN_CONTRACT_ADDRESS` | Deployed KadraToken address on Base Sepolia | `0x...` |
| `IDENTITY_REGISTRY_ADDRESS` | Deployed IdentityRegistry address | `0x...` |
| `DOCUMENT_REGISTRY_ADDRESS` | Deployed DocumentRegistry address (optional) | `0x...` |
| `SUPABASE_URL` | Supabase project URL | `https://[REF].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name | `documents` |
| `CRON_SERVICE_TOKEN` | Shared secret for cron/admin job endpoints | Generate with `openssl rand -hex 32` |
| `JWT_SECRET` | App JWT secret (if auth enabled) | Generate with `openssl rand -hex 32` |
| `PORT` | Server port (Vercel sets automatically) | `3000` |

---

## Supabase Setup

### 1. Create Project

1. Create a new project at [supabase.com](https://supabase.com).
2. Copy the connection string from Settings > Database.

### 2. Create Storage Bucket

1. Navigate to Settings > Storage > New Bucket.
2. Name the bucket `documents`.
3. Set the bucket to **private**.

### 3. Run Migrations and Seed

```bash
cd backend

DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
  npx prisma db seed
```

---

## Supabase Cron Setup

Navigate to Supabase Dashboard > SQL Editor and run the following SQL. Replace `YOUR-VERCEL-BACKEND.vercel.app` with the actual backend URL and `YOUR_CRON_SERVICE_TOKEN` with the generated token.

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job runner: every 2 minutes, drain queued jobs
SELECT cron.schedule(
  'kadra-job-runner',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR-VERCEL-BACKEND.vercel.app/api/v1/admin/jobs/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-service-token', 'YOUR_CRON_SERVICE_TOKEN'
    ),
    body := '{"batchSize": 25}'::jsonb
  );
  $$
);

-- Chain event ingestion: every minute
SELECT cron.schedule(
  'kadra-chain-ingest',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR-VERCEL-BACKEND.vercel.app/api/v1/admin/jobs/chain-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-service-token', 'YOUR_CRON_SERVICE_TOKEN'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Transaction sync: every minute
SELECT cron.schedule(
  'kadra-tx-sync',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR-VERCEL-BACKEND.vercel.app/api/v1/admin/jobs/tx-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-service-token', 'YOUR_CRON_SERVICE_TOKEN'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Note:** Supabase Cron requires the `pg_cron` and `pg_net` extensions. These are available on the Pro plan. For the Free plan, use an external cron service (e.g., cron-job.org) to hit the same endpoints with the `x-service-token` header.

---

## Vercel Frontend Setup

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

### Environment Variable

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://YOUR-VERCEL-BACKEND.vercel.app/api/v1` |

---

## Smoke Test Steps

Run these after deployment to verify the system is operational.

### 1. Health Check

```bash
curl https://YOUR-BACKEND.vercel.app/api/v1/health
```

### 2. Fund Overview (requires seeded data)

```bash
curl https://YOUR-BACKEND.vercel.app/api/v1/admin/funds/FUND_ID/overview
```

### 3. Manual Job Run

```bash
curl -X POST https://YOUR-BACKEND.vercel.app/api/v1/admin/jobs/run \
  -H "Content-Type: application/json" \
  -H "x-service-token: YOUR_TOKEN" \
  -d '{"batchSize": 5}'
```

### 4. Chain Ingest

```bash
curl -X POST https://YOUR-BACKEND.vercel.app/api/v1/admin/jobs/chain-ingest \
  -H "Content-Type: application/json" \
  -H "x-service-token: YOUR_TOKEN" \
  -d '{}'
```

---

## Known Limitations

- **Serverless function timeout**: 10s on Hobby plan, 60s on Pro plan. Long-running jobs must be split into stages.
- **No websocket support**: Vercel serverless does not support persistent connections. Chain event ingestion uses polling via cron.
- **Cold starts**: First request after an idle period may add 1-3s latency.
