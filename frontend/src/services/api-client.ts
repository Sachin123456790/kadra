import { API_BASE_URL, AUTH_TOKEN_KEY, AUTH_REFRESH_TOKEN_KEY, AUTH_USER_KEY, HTTP_STATUS } from '@/config/constants';

// ── Types ──────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta: { requestId: string; timestamp: string; count?: number };
}

export interface ApiError {
  error: { code: string; message: string };
  meta: { requestId: string; timestamp: string };
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// ── 401 listener ───────────────────────────────────────────

type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;

export function setOnUnauthorized(listener: UnauthorizedListener | null) {
  onUnauthorized = listener;
}

// ── Token refresh ──────────────────────────────────────────

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const body = await res.json();
    const data = body?.data;
    if (!data?.accessToken) return false;

    // Update stored tokens
    localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, data.refreshToken);
    }
    if (data.user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    }
    return true;
  } catch {
    return false;
  }
}

/** Deduplicated refresh — only one in-flight refresh at a time. */
function refreshOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = tryRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ── Helpers ────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response, retryFn?: () => Promise<Response>): Promise<T> {
  if (res.status === HTTP_STATUS.UNAUTHORIZED && retryFn) {
    // Attempt silent refresh before giving up
    const refreshed = await refreshOnce();
    if (refreshed) {
      const retryRes = await retryFn();
      // Recursive call without retryFn to avoid infinite loop
      return handleResponse<T>(retryRes);
    }
    // Refresh failed — trigger logout
    onUnauthorized?.();
    const body = await res.json().catch(() => ({}));
    throw new ApiRequestError(
      res.status,
      body?.error?.code ?? 'UNAUTHORIZED',
      body?.error?.message ?? 'Session expired',
      body?.meta?.requestId,
    );
  }

  if (res.status === HTTP_STATUS.UNAUTHORIZED) {
    onUnauthorized?.();
    const body = await res.json().catch(() => ({}));
    throw new ApiRequestError(
      res.status,
      body?.error?.code ?? 'UNAUTHORIZED',
      body?.error?.message ?? 'Session expired',
      body?.meta?.requestId,
    );
  }

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? `Request failed (${res.status})`,
      body?.meta?.requestId,
    );
  }

  return (body ?? { data: null, meta: {} }) as T;
}

// ── GET / POST / Upload wrappers ───────────────────────────

export async function get<T>(path: string): Promise<ApiResponse<T>> {
  const doFetch = () => fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...getAuthHeaders(),
    },
  });
  const res = await doFetch();
  return handleResponse<ApiResponse<T>>(res, doFetch);
}

export async function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const doFetch = () => fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...getAuthHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await doFetch();
  return handleResponse<ApiResponse<T>>(res, doFetch);
}

export async function put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const doFetch = () => fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...getAuthHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await doFetch();
  return handleResponse<ApiResponse<T>>(res, doFetch);
}

export async function upload<T>(
  path: string,
  file: File,
  fieldName = 'file',
  extraFields?: Record<string, string | number>,
): Promise<ApiResponse<T>> {
  const doFetch = () => {
    const formData = new FormData();
    formData.append(fieldName, file);
    if (extraFields) {
      for (const [k, v] of Object.entries(extraFields)) {
        formData.append(k, String(v));
      }
    }
    return fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        // Do NOT set Content-Type — browser sets multipart boundary automatically
      },
      body: formData,
    });
  };
  const res = await doFetch();
  return handleResponse<ApiResponse<T>>(res, doFetch);
}
