/**
 * Thin fetch wrapper for the Swatchy API. Every call needs a fresh Clerk
 * session token, so callers pass a `getToken` (from Clerk's `useAuth()`)
 * rather than this module holding one itself — tokens rotate/expire and
 * Clerk's hook is the only thing that knows how to refresh them.
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

if (!API_URL && __DEV__) {
  console.warn(
    '[api] EXPO_PUBLIC_API_URL is not set — API calls will fail. Set it in .env (see .env.example).'
  );
}

export type GetToken = () => Promise<string | null>;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  getToken: GetToken,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getToken();

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (!isFormData && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = text;
    try {
      message = JSON.parse(text).error ?? text;
    } catch {
      // not JSON — use the raw text
    }
    throw new ApiError(res.status, message || `${res.status} ${res.statusText}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function makeApi(getToken: GetToken) {
  return {
    get: <T>(path: string) => request<T>(getToken, path),
    post: <T>(path: string, body?: unknown) =>
      request<T>(getToken, path, {
        method: 'POST',
        body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
      }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(getToken, path, { method: 'PATCH', body: JSON.stringify(body) }),
    del: <T>(path: string) => request<T>(getToken, path, { method: 'DELETE' }),
    /** Absolute URL for a server-relative path, e.g. a post's photo. */
    resolve: (path: string) => `${API_URL}${path}`,
  };
}

export type Api = ReturnType<typeof makeApi>;
