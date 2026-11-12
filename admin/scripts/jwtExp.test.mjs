import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getJwtExpSeconds,
  isJwtExpired,
} from '../src/lib/jwtExp.ts';

function createMockToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = 'mock_signature_bytes';
  return `${header}.${body}.${sig}`;
}

describe('jwtExp helper', () => {
  it('extracts valid numerical exp from token payload', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = createMockToken({ sub: 'admin1', role: 'super_admin', exp: futureExp });

    const result = getJwtExpSeconds(token);
    assert.equal(result, futureExp);
    assert.equal(isJwtExpired(token), false);
  });

  it('correctly reports expired token when exp is in the past', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 60;
    const token = createMockToken({ sub: 'admin1', exp: pastExp });

    assert.equal(getJwtExpSeconds(token), pastExp);
    assert.equal(isJwtExpired(token), true);
  });

  it('returns null and reports expired when exp claim is missing', () => {
    const token = createMockToken({ sub: 'admin1', role: 'super_admin' });

    assert.equal(getJwtExpSeconds(token), null);
    assert.equal(isJwtExpired(token), true);
  });

  it('returns null and reports expired on malformed non-JWT strings', () => {
    assert.equal(getJwtExpSeconds(null), null);
    assert.equal(getJwtExpSeconds(''), null);
    assert.equal(getJwtExpSeconds('not_a_jwt'), null);
    assert.equal(getJwtExpSeconds('only.two.parts.extra.parts'), null);
    assert.equal(isJwtExpired('invalid_token'), true);
  });

  it('returns null and reports expired on non-base64 or invalid JSON payload', () => {
    const badToken = 'eyJhbGciOiJIUzI1NiJ9.!!!not_valid_base64!!!.sig';
    assert.equal(getJwtExpSeconds(badToken), null);
    assert.equal(isJwtExpired(badToken), true);

    const nonJsonPayloadToken = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from('just raw text').toString('base64url') + '.sig';
    assert.equal(getJwtExpSeconds(nonJsonPayloadToken), null);
  });
});

