import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/config/constants';

/**
 * Fetch an authenticated blob URL and trigger a browser download.
 * Path is joined to the API base URL; pass an absolute URL to skip the prefix.
 */
export async function downloadBlob(path: string, filename: string): Promise<void> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
