import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTokenExpired,
  getRemainingSeconds,
  formatRemainingTime,
  DEFAULT_PREVIEW_TTL_MS,
} from '../src/lib/previewExpiry.ts';

describe('previewExpiry helper', () => {
  const baseTime = 1700000000000;

  describe('isTokenExpired', () => {
    it('treats missing, null, or invalid timestamp as expired', () => {
      assert.equal(isTokenExpired(undefined, baseTime), true);
      assert.equal(isTokenExpired(null, baseTime), true);
      assert.equal(isTokenExpired(NaN, baseTime), true);
    });

    it('returns false for fresh token', () => {
      assert.equal(isTokenExpired(baseTime, baseTime), false);
      assert.equal(isTokenExpired(baseTime, baseTime + 60000), false);
      assert.equal(isTokenExpired(baseTime, baseTime + DEFAULT_PREVIEW_TTL_MS - 1), false);
    });

    it('returns true at exact 5-minute boundary and beyond', () => {
      assert.equal(isTokenExpired(baseTime, baseTime + DEFAULT_PREVIEW_TTL_MS), true);
      assert.equal(isTokenExpired(baseTime, baseTime + DEFAULT_PREVIEW_TTL_MS + 1000), true);
    });

    it('handles backward clock skew without prematurely expiring', () => {
      assert.equal(isTokenExpired(baseTime, baseTime - 5000), false);
    });
  });

  describe('getRemainingSeconds', () => {
    it('returns 300 seconds for freshly received token', () => {
      assert.equal(getRemainingSeconds(baseTime, baseTime), 300);
    });

    it('computes remaining seconds accurately during the window', () => {
      assert.equal(getRemainingSeconds(baseTime, baseTime + 60000), 240);
      assert.equal(getRemainingSeconds(baseTime, baseTime + 150000), 150);
      assert.equal(getRemainingSeconds(baseTime, baseTime + DEFAULT_PREVIEW_TTL_MS - 500), 1);
    });

    it('returns 0 when expired', () => {
      assert.equal(getRemainingSeconds(baseTime, baseTime + DEFAULT_PREVIEW_TTL_MS), 0);
      assert.equal(getRemainingSeconds(baseTime, baseTime + DEFAULT_PREVIEW_TTL_MS + 5000), 0);
    });

    it('returns 0 for null/undefined/invalid received time', () => {
      assert.equal(getRemainingSeconds(null, baseTime), 0);
      assert.equal(getRemainingSeconds(undefined, baseTime), 0);
    });

    it('handles backwards clock skew by clamping to max ttl', () => {
      assert.equal(getRemainingSeconds(baseTime, baseTime - 10000), 300);
    });
  });

  describe('formatRemainingTime', () => {
    it('formats seconds into MM:SS string correctly', () => {
      assert.equal(formatRemainingTime(300), '5:00');
      assert.equal(formatRemainingTime(299), '4:59');
      assert.equal(formatRemainingTime(65), '1:05');
      assert.equal(formatRemainingTime(9), '0:09');
      assert.equal(formatRemainingTime(0), '0:00');
      assert.equal(formatRemainingTime(-5), '0:00');
    });
  });
});

