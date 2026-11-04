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

process.env.VITE_API_BASE_URL = 'http://localhost:8000';

import { getToken, setToken, clearToken } from '../lib/auth.ts';
import { apiFetch, ApiError } from '../lib/api.ts';

describe('Auth flow and contracts', () => {
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

  it('hydrates user when valid token exists in storage via GET /auth/me', async () => {
    setToken('valid-jwt-token');

    let capturedUrl = '';
    let capturedHeaders: any = null;

    globalThis.fetch = async (url: any, options: any) => {
      capturedUrl = url.toString();
      capturedHeaders = options.headers;
      return new Response(
        JSON.stringify({
          user: {
            id: 'usr-123',
            email: 'traveler@luxury.com',
            name: 'Sophia Laurent',
            createdAt: '2026-10-31T00:00:00.000Z',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const res = await apiFetch<{ user: any }>('/auth/me');
    assert.equal(capturedUrl, 'http://localhost:8000/auth/me');
    assert.equal(capturedHeaders.get('Authorization'), 'Bearer valid-jwt-token');
    assert.equal(res.user.email, 'traveler@luxury.com');
    assert.equal(res.user.name, 'Sophia Laurent');
  });

  it('handles tampered token: 401 response clears token and fires auth:expired event', async () => {
    setToken('tampered-jwt-token');

    let expiredFired = 0;
    (globalThis as any).window.addEventListener('auth:expired', () => {
      expiredFired += 1;
    });

    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await apiFetch('/auth/me');
      },
      (err: any) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.message, 'Invalid authentication token');
        return true;
      }
    );

    assert.equal(expiredFired, 1, 'auth:expired must be fired on 401');
    assert.equal(getToken(), null, 'token must be cleared on 401');
  });

  it('login sends POST /auth/login with { email, password } and returns token + user', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody = '';

    globalThis.fetch = async (url: any, options: any) => {
      capturedUrl = url.toString();
      capturedMethod = options.method;
      capturedBody = options.body;
      return new Response(
        JSON.stringify({
          token: 'new-session-jwt',
          user: {
            id: 'usr-456',
            email: 'arjun@example.com',
            name: 'Arjun Mehta',
            createdAt: '2026-10-31T00:00:00.000Z',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const data = await apiFetch<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: { email: 'arjun@example.com', password: 'secretpassword' },
    });

    assert.equal(capturedUrl, 'http://localhost:8000/auth/login');
    assert.equal(capturedMethod, 'POST');
    assert.equal(
      capturedBody,
      JSON.stringify({ email: 'arjun@example.com', password: 'secretpassword' })
    );
    assert.equal(data.token, 'new-session-jwt');
    assert.equal(data.user.email, 'arjun@example.com');
  });

  it('login with wrong password returns 401 with backend message and throws ApiError', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await apiFetch('/auth/login', {
          method: 'POST',
          body: { email: 'arjun@example.com', password: 'wrongpassword' },
        });
      },
      (err: any) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.message, 'Invalid email or password');
        return true;
      }
    );
  });

  it('signup sends POST /auth/signup with { email, password } and returns 201 with token + user', async () => {
    let capturedUrl = '';
    let capturedBody = '';

    globalThis.fetch = async (url: any, options: any) => {
      capturedUrl = url.toString();
      capturedBody = options.body;
      return new Response(
        JSON.stringify({
          token: 'signup-jwt',
          user: {
            id: 'usr-789',
            email: 'newuser@luxury.com',
            name: '',
            createdAt: '2026-10-31T00:00:00.000Z',
          },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    const data = await apiFetch<{ token: string; user: any }>('/auth/signup', {
      method: 'POST',
      body: { email: 'newuser@luxury.com', password: 'newpassword123' },
    });

    assert.equal(capturedUrl, 'http://localhost:8000/auth/signup');
    assert.equal(
      capturedBody,
      JSON.stringify({ email: 'newuser@luxury.com', password: 'newpassword123' })
    );
    assert.equal(data.token, 'signup-jwt');
    assert.equal(data.user.email, 'newuser@luxury.com');
  });

  it('signup with existing email returns 409 with backend message', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({ error: 'Email already exists' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    };

    await assert.rejects(
      async () => {
        await apiFetch('/auth/signup', {
          method: 'POST',
          body: { email: 'existing@luxury.com', password: 'password123' },
        });
      },
      (err: any) => {
        assert(err instanceof ApiError);
        assert.equal(err.status, 409);
        assert.equal(err.message, 'Email already exists');
        return true;
      }
    );
  });
});
