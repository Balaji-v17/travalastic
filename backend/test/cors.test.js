import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import cors from 'cors';

function buildCorsMiddleware(webOriginsEnv) {
  const allowedOrigins = (webOriginsEnv || 'http://localhost:8443,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
}

function simulateRequest(middleware, origin, method = 'GET', requestHeaders = {}) {
  const headers = {};
  const req = {
    headers: {
      ...(origin ? { origin } : {}),
      ...requestHeaders,
    },
    method,
  };
  let nextCalled = false;
  const res = {
    setHeader: (key, val) => {
      headers[key.toLowerCase()] = val;
    },
    getHeader: (key) => headers[key.toLowerCase()],
    statusCode: 200,
    end: () => {},
  };

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { headers, nextCalled };
}

describe('Backend CORS Configuration', () => {
  it('allows http://localhost:5173 and returns CORS header', () => {
    const middleware = buildCorsMiddleware();
    const { headers, nextCalled } = simulateRequest(middleware, 'http://localhost:5173');
    assert.equal(headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.notEqual(headers['access-control-allow-origin'], '*');
    assert.equal(nextCalled, true);
  });

  it('allows http://localhost:8443 and returns CORS header', () => {
    const middleware = buildCorsMiddleware();
    const { headers, nextCalled } = simulateRequest(middleware, 'http://localhost:8443');
    assert.equal(headers['access-control-allow-origin'], 'http://localhost:8443');
    assert.equal(nextCalled, true);
  });

  it('rejects http://evil.example and does NOT return CORS header', () => {
    const middleware = buildCorsMiddleware();
    const { headers, nextCalled } = simulateRequest(middleware, 'http://evil.example');
    assert.equal(headers['access-control-allow-origin'], undefined);
    assert.equal(nextCalled, true);
  });

  it('allows requests without origin (curl, mobile) without CORS header', () => {
    const middleware = buildCorsMiddleware();
    const { headers, nextCalled } = simulateRequest(middleware, null);
    assert.equal(headers['access-control-allow-origin'], undefined);
    assert.equal(nextCalled, true);
  });

  it('supports preflight OPTIONS for allowed origin with Authorization and Content-Type', () => {
    const middleware = buildCorsMiddleware();
    const { headers } = simulateRequest(middleware, 'http://localhost:5173', 'OPTIONS', {
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization, content-type',
    });
    assert.equal(headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(headers['access-control-allow-headers'], 'Authorization,Content-Type');
  });

  it('rejects preflight OPTIONS for untrusted origin', () => {
    const middleware = buildCorsMiddleware();
    const { headers } = simulateRequest(middleware, 'http://evil.example', 'OPTIONS', {
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'authorization, content-type',
    });
    assert.equal(headers['access-control-allow-origin'], undefined);
  });

  it('respects custom WEB_ORIGINS env variable', () => {
    const middleware = buildCorsMiddleware('https://travalastic.com, https://admin.travalastic.com');
    const res1 = simulateRequest(middleware, 'https://travalastic.com');
    assert.equal(res1.headers['access-control-allow-origin'], 'https://travalastic.com');

    const res2 = simulateRequest(middleware, 'http://localhost:5173');
    assert.equal(res2.headers['access-control-allow-origin'], undefined);
  });
});

