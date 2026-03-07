# Frontend API Integration

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  React Page  │────>│  useQuery()  │────>│  service.ts  │
│  Component   │     │  useMutation │     │  functions    │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                          ┌──────▼───────┐
                                          │  api-client   │
                                          │  get/post/    │
                                          │  upload       │
                                          └──────┬───────┘
                                                 │
                                          ┌──────▼───────┐
                                          │  fetch()      │
                                          │  + auth hdrs  │
                                          │  + 401 intrcpt│
                                          └──────────────┘
```

## Configuration

All config lives in `src/config/constants.ts`:

- `API_BASE_URL` — derived from `VITE_API_URL` env var, defaults to `/api/v1`
- `AUTH_TOKEN_KEY` / `AUTH_USER_KEY` — localStorage keys
- `QUERY_KEYS` — React Query cache key factories
- `ROUTES` — route path constants
- `HTTP_STATUS` — HTTP status code constants

## API Client (`services/api-client.ts`)

Three wrapper functions, all returning `ApiResponse<T>`:

### `get<T>(path: string)`

```ts
import { get } from '@/services';
const { data } = await get<FundOverview>('/admin/funds/abc/overview');
```

### `post<T>(path: string, body?: unknown)`

```ts
import { post } from '@/services';
const { data } = await post<MintResult>('/admin/subscriptions/abc/token-mint', {});
```

### `upload<T>(path: string, file: File)`

```ts
import { upload } from '@/services';
const { data } = await upload<UploadResult>('/admin/funds/abc/documents/master-lpa', file);
```

### Error Handling

All wrappers throw `ApiRequestError` on non-2xx responses:

```ts
import { ApiRequestError } from '@/services';

try {
  await mintTokens(subscriptionId);
} catch (err) {
  if (err instanceof ApiRequestError) {
    console.error(err.code, err.message, err.status);
  }
}
```

### 401 Interceptor

The API client has a global 401 listener. `AuthProvider` wires it on mount:

1. Any API call returns 401
2. `onUnauthorized` callback fires
3. Auth state cleared from localStorage
4. User redirected to `/login`

No manual token refresh logic — the interceptor handles it automatically.

## Service Files

Each backend module has a corresponding service file with typed functions:

| Service | Functions |
|---|---|
| `fund.service.ts` | `getFundOverview`, `getWaterfallConfig` |
| `investors.service.ts` | `getInvestors` |
| `subscriptions.service.ts` | `getSubscriptions`, `createSubscriptions` |
| `settlements.service.ts` | `requestPaymentValidation`, `confirmSettlement` |
| `tokenization.service.ts` | `mintTokens`, `initiateTransfer`, `getTransferValidation`, `getFailedTransfers`, `getSuccessfulTransfers` |
| `ownership.service.ts` | `getCapTable`, `getOwnershipHistory` |
| `distribution.service.ts` | `previewDistribution`, `executeDistribution` |
| `documents.service.ts` | `uploadMasterLpa`, `getDocumentHashes`, `getParseStatus` |
| `audit.service.ts` | `createAuditExport`, `getAuditExport` |

All exported from `services/index.ts` for convenience.

## Usage with React Query

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/config/constants';
import { getCapTable, initiateTransfer } from '@/services';

function CapTablePage({ fundId }: { fundId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.capTable(fundId),
    queryFn: () => getCapTable(fundId).then(r => r.data),
  });

  const transfer = useMutation({
    mutationFn: (input) => initiateTransfer(fundId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.capTable(fundId) }),
  });
}
```

## Auth Flow

### AuthProvider

Wraps the entire app inside `<BrowserRouter>`. Manages:
- Hydration from localStorage on mount
- `login(token, user)` — stores token + user, sets state
- `logout()` — clears storage, redirects to `/login`
- 401 interceptor wiring via `setOnUnauthorized()`

### AuthGuard

Route-level protection:

```tsx
<AuthGuard>
  <ProtectedPage />
</AuthGuard>
```

Or as HOC:

```tsx
export default withAuth(MyPage);
```

Shows loading spinner while hydrating, redirects to `/login` if unauthenticated.
Preserves the original URL in `location.state.from` for redirect-after-login.

### Login Flow

1. User visits any protected route → redirected to `/login`
2. User submits credentials → `login(token, user)` called
3. Redirected back to original route
4. All subsequent API calls include `Authorization: Bearer <token>` header

## Vite Proxy

In development, `/api/v1/*` is proxied to `http://localhost:3000`:

```ts
// vite.config.ts
proxy: {
  '/api/v1': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
}
```

No CORS configuration needed. In production, the frontend is served from the same domain or `VITE_API_URL` is set to the backend URL.
