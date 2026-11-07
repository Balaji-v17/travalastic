import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Set up minimal browser polyfills in Node environment for tests
const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, String(v)),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
};

(globalThis as any).localStorage = mockLocalStorage;

const eventListeners: Record<string, ((event: any) => void)[]> = {};
(globalThis as any).window = {
  dispatchEvent: (event: { type: string; detail?: any }) => {
    const list = eventListeners[event.type] || [];
    for (const listener of list) {
      listener(event);
    }
    return true;
  },
  addEventListener: (type: string, fn: (event: any) => void) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push(fn);
  },
  removeEventListener: (type: string, fn: (event: any) => void) => {
    if (eventListeners[type]) {
      eventListeners[type] = eventListeners[type].filter((cb) => cb !== fn);
    }
  },
};

(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, params?: { detail?: any }) {
    this.type = type;
    this.detail = params?.detail;
  }
};

process.env.VITE_API_BASE_URL = 'https://api.travalastic.test';

import { getToken, setToken, clearToken } from './auth.ts';
import { apiFetch, pingHealth, ApiError, getApiBaseUrl } from './api.ts';

describe('Auth storage helper (web/src/lib/auth.ts)', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('stores, retrieves, and clears the token under travalastic_token key', () => {
    assert.equal(getToken(), null);
    setToken('jwt-test-token-123');
    assert.equal(getToken(), 'jwt-test-token-123');
    assert.equal(storage.get('travalastic_token'), 'jwt-test-token-123');
    clearToken();
    assert.equal(getToken(), null);
    assert.equal(storage.get('travalastic_token'), undefined);
  });

  it('safely handles disabled / throwing localStorage (private browsing)', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('Access denied');
      },
      setItem: () => {
        throw new Error('Quota exceeded');
      },
      removeItem: () => {
        throw new Error('Access denied');
      },
    };
    (globalThis as any).localStorage = brokenStorage;

    assert.equal(getToken(), null);
    assert.doesNotThrow(() => setToken('some-token'));
    assert.doesNotThrow(() => clearToken());

    (globalThis as any).localStorage = mockLocalStorage;
  });
});

describe('Web API client (web/src/lib/api.ts)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    storage.clear();
    for (const key of Object.keys(eventListeners)) {
      delete eventListeners[key];
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('pingHealth calls /health and returns { status: "ok" }', async () => {
    globalThis.fetch = async (url: any, options: any) => {
      assert.equal(url.toString(), `${getApiBaseUrl()}/health`);
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const health = await pingHealth();
    assert.deepEqual(health, { status: 'ok' });
  });

  it('attaches Authorization: Bearer <token> when non-null and prepends base URL', async () => {
    setToken('user-jwt-456');

    let capturedUrl = '';
    let capturedHeaders: any = null;
    let capturedBody: any = null;

    globalThis.fetch = async (url: any, options: any) => {
      capturedUrl = url.toString();
      capturedHeaders = options.headers;
      capturedBody = options.body;
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const result = await apiFetch<{ success: boolean }>('itinerary/custom', {
      method: 'POST',
      body: { title: 'Trip to Tokyo' } as any,
    });

    assert.equal(capturedUrl, `${getApiBaseUrl()}/itinerary/custom`);
    assert.equal(capturedHeaders?.get('Authorization'), 'Bearer user-jwt-456');
    assert.equal(capturedHeaders?.get('Content-Type'), 'application/json');
    assert.equal(capturedBody, JSON.stringify({ title: 'Trip to Tokyo' }));
    assert.deepEqual(result, { success: true });
  });

  it('on 401: clears stored token, fires auth:expired event on window, and throws ApiError', async () => {
    setToken('expired-jwt');

    let eventFired = 0;
    (globalThis as any).window.addEventListener('auth:expired', () => {
      eventFired += 1;
    });

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ error: { message: 'Token expired or invalid' } }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await apiFetch('/protected-endpoint');
      },
      (err: any) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.message, 'Token expired or invalid');
        return true;
      }
    );

    assert.equal(eventFired, 1, 'auth:expired event must fire exactly once');
    assert.equal(getToken(), null, 'token must be cleared on 401');
  });

  it('handles backend error shapes (data.error.message, data.error, data.message, code)', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ error: { message: 'Offer expired', code: 'OFFER_EXPIRED' } }),
        {
          status: 410,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await apiFetch('/offer');
      },
      (err: any) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 410);
        assert.equal(err.message, 'Offer expired');
        assert.equal(err.code, 'OFFER_EXPIRED');
        return true;
      }
    );

    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ error: 'Direct error string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    await assert.rejects(
      async () => {
        await apiFetch('/bad-request');
      },
      (err: any) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 400);
        assert.equal(err.message, 'Direct error string');
        return true;
      }
    );
  });

  it('throws ApiError with "The server is waking up, please try again" on AbortError timeout', async () => {
    globalThis.fetch = async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      throw abortError;
    };

    await assert.rejects(
      async () => {
        await apiFetch('/slow-endpoint');
      },
      (err: any) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 408);
        assert.equal(err.message, 'The server is waking up, please try again');
        return true;
      }
    );
  });
});
