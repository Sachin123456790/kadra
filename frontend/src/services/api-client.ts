import { API_BASE_URL, AUTH_TOKEN_KEY, HTTP_STATUS } from '@/config/constants';

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

// ── Helpers ────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
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

  const body = await res.json();

  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? `Request failed (${res.status})`,
      body?.meta?.requestId,
    );
  }

  return body as T;
}

// ── GET / POST / Upload wrappers ───────────────────────────

export async function get<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...getAuthHeaders(),
    },
  });
  return handleResponse<ApiResponse<T>>(res);
}

export async function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...getAuthHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleResponse<ApiResponse<T>>(res);
}

export async function upload<T>(path: string, file: File, fieldName = 'file'): Promise<ApiResponse<T>> {
  const formData = new FormData();
  formData.append(fieldName, file);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      // Do NOT set Content-Type — browser sets multipart boundary automatically
    },
    body: formData,
  });
  return handleResponse<ApiResponse<T>>(res);
}
