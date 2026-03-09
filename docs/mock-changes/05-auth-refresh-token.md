# Auth: Silent Token Refresh

## What Changed
Added automatic JWT refresh to prevent "token expired" errors that required manual re-login.

## Files Changed

### Backend
- `backend/src/modules/auth/auth.service.ts` -- Added `refresh(refreshToken)` method calling Supabase `grant_type=refresh_token`
- `backend/src/modules/auth/auth.controller.ts` -- Added `@Public() @Post('refresh')` endpoint
- `backend/src/modules/auth/auth.dto.ts` -- Added `RefreshDto` validation class

### Frontend
- `frontend/src/services/api-client.ts` -- Added `tryRefreshToken()` and `refreshOnce()` for deduplicated silent refresh; all requests retry once on 401
- `frontend/src/components/kadra/AuthProvider.tsx` -- Stores/clears refresh token in localStorage
- `frontend/src/hooks/useAuth.ts` -- Login accepts optional refreshToken parameter
- `frontend/src/config/constants.ts` -- Added `AUTH_REFRESH_TOKEN_KEY`
- `frontend/src/pages/LoginPage.tsx` -- Passes refreshToken from login response

## How It Works Now
1. Login stores both access token and refresh token
2. On 401 response, api-client silently calls `/auth/refresh`
3. New tokens stored, original request retried
4. Concurrent 401s deduplicated (single refresh request)
5. If refresh fails, user is logged out
