const SESSION_STORAGE_KEY = 'travalastic_admin_token';

// In-memory token store (mirrored to sessionStorage safely)
let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) {
    return memoryToken;
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored && stored.trim().length > 0) {
        memoryToken = stored.trim();
        return memoryToken;
      }
    }
  } catch {
    // sessionStorage blocked or restricted; fallback to in-memory only
  }
  return null;
}

export function setToken(token: string | null): void {
  memoryToken = token ? token.trim() : null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (memoryToken) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, memoryToken);
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage failure
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failure
  }
}

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env?.VITE_API_BASE_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  timeoutMs?: number;
}

/**
 * apiFetch (Admin)
 * - Sets Authorization: Bearer <token>
 * - Default 15 s timeout
 * - On 401: clears session, dispatches event, and throws "Your session ended. Please sign in again."
 * - On 429: throws "Too many attempts. Try again later."
 * - On network failure / timeout: throws "The server may be waking up. Retrying can take up to a minute."
 * - Never logs credentials or tokens.
 */
export async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type') && options?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body = options?.body;
  if (
    body !== undefined &&
    body !== null &&
    typeof body === 'object' &&
    !(body instanceof FormData)
  ) {
    body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 15000;
  let didTimeout = false;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      body: body as BodyInit,
      signal: controller.signal,
    });

    let data: any = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    } else {
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      if (res.status === 401) {
        clearToken();
        const sessionEndedMsg = 'Your session ended. Please sign in again.';
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('admin:session-ended', { detail: { message: sessionEndedMsg } })
          );
        }
        throw new ApiError(401, sessionEndedMsg);
      }

      const code = data?.code || (data?.error && typeof data.error === 'object' ? data.error.code : undefined);

      if (res.status === 403 && (code === 'PASSWORD_CHANGE_REQUIRED' || (typeof data?.error === 'string' && /password change/i.test(data.error)))) {
        const pwdRequiredMsg = typeof data?.error === 'string' ? data.error : 'Password change required before accessing administrative resources';
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('admin:password-change-required', { detail: { message: pwdRequiredMsg } })
          );
        }
        throw new ApiError(403, pwdRequiredMsg, 'PASSWORD_CHANGE_REQUIRED');
      }

      if (res.status === 429) {
        let msg = 'Too many attempts. Try again later.';
        if (data && typeof data.error === 'string') {
          msg = data.error;
        } else if (data && typeof data.error?.message === 'string') {
          msg = data.error.message;
        }
        throw new ApiError(429, msg, code);
      }

      let message = 'Request failed';
      if (data && typeof data.error === 'string') {
        message = data.error;
      } else if (data && typeof data.error?.message === 'string') {
        message = data.error.message;
      } else if (res.statusText) {
        message = res.statusText;
      }

      throw new ApiError(res.status, message, code);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (didTimeout || (err?.name === 'AbortError' && !options?.signal?.aborted)) {
      throw new ApiError(
        408,
        'The server may be waking up. Retrying can take up to a minute.'
      );
    }
    if (err?.name === 'AbortError') {
      throw new ApiError(0, 'Request aborted');
    }

    // Network / fetch failures
    throw new ApiError(
      0,
      'The server may be waking up. Retrying can take up to a minute.'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

