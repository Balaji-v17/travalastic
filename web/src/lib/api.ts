import { getToken, clearToken } from './auth.ts';

const rawBaseUrl =
  import.meta.env?.VITE_API_BASE_URL ??
  (typeof process !== 'undefined' ? process.env?.VITE_API_BASE_URL : undefined);

export const hasValidApiBase = Boolean(
  rawBaseUrl && typeof rawBaseUrl === 'string' && rawBaseUrl.trim()
);

export function getApiBaseUrl(): string {
  const current =
    import.meta.env?.VITE_API_BASE_URL ??
    (typeof process !== 'undefined' ? process.env?.VITE_API_BASE_URL : undefined);
  if (!current || typeof current !== 'string' || !current.trim()) {
    throw new Error(
      'Missing required environment variable VITE_API_BASE_URL. Please set VITE_API_BASE_URL in your environment or .env file.'
    );
  }
  return current.trim().replace(/\/+$/, '');
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

export async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
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
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !(body instanceof URLSearchParams)
  ) {
    body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 20000;
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

    const contentType = res.headers.get('content-type') || '';
    let data: any = null;
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
      if (res.status === 401 && !(normalizedPath === '/auth/me' && options?.method === 'DELETE')) {
        clearToken();
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }

      let message = res.statusText || 'Request failed';
      let code: string | undefined = undefined;

      if (data) {
        if (typeof data.error === 'object' && data.error !== null) {
          if (typeof data.error.message === 'string') {
            message = data.error.message;
          }
          if (typeof data.error.code === 'string') {
            code = data.error.code;
          }
        } else if (typeof data.error === 'string') {
          message = data.error;
        } else if (typeof data.message === 'string') {
          message = data.message;
        }

        if (!code && typeof data.code === 'string') {
          code = data.code;
        }
      }

      throw new ApiError(res.status, message, code);
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (didTimeout || (err?.name === 'AbortError' && !options?.signal?.aborted)) {
      throw new ApiError(408, 'The server is waking up, please try again');
    }
    if (err?.name === 'AbortError') {
      throw new ApiError(0, 'Request aborted');
    }
    throw new ApiError(0, err?.message || 'Network request failed');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function pingHealth(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/health');
}
