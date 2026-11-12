import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePriceAge } from '../src/lib/priceAge.ts';

describe('priceAge helper', () => {
  const referenceNow = new Date('2026-11-12T12:00:00.000Z');

  it('handles missing, null, or undefined review dates', () => {
    const resNull = computePriceAge(null, referenceNow);
    assert.equal(resNull.formattedDate, 'Not recorded');
    assert.equal(resNull.isOlderThan180Days, true);
    assert.equal(resNull.daysAgo, null);
    assert.equal(resNull.status, 'missing');

    const resUndefined = computePriceAge(undefined, referenceNow);
    assert.equal(resUndefined.formattedDate, 'Not recorded');
    assert.equal(resUndefined.isOlderThan180Days, true);
    assert.equal(resUndefined.status, 'missing');

    const resEmpty = computePriceAge('', referenceNow);
    assert.equal(resEmpty.formattedDate, 'Not recorded');
    assert.equal(resEmpty.status, 'missing');

    const resInvalid = computePriceAge('invalid-date', referenceNow);
    assert.equal(resInvalid.formattedDate, 'Not recorded');
    assert.equal(resInvalid.isOlderThan180Days, true);
    assert.equal(resInvalid.status, 'missing');
  });

  it('identifies price reviews younger than 180 days as current', () => {
    // 30 days ago
    const thirtyDaysAgo = new Date('2026-10-13T12:00:00.000Z');
    const res30 = computePriceAge(thirtyDaysAgo, referenceNow);
    assert.equal(res30.isOlderThan180Days, false);
    assert.equal(res30.status, 'current');
    assert.equal(res30.daysAgo, 30);
    assert.match(res30.formattedDate, /Oct 13, 2026/);

    // exactly 180 days ago
    const exactly180 = new Date('2026-05-16T12:00:00.000Z');
    const res180 = computePriceAge(exactly180, referenceNow);
    assert.equal(res180.isOlderThan180Days, false);
    assert.equal(res180.status, 'current');
  });

  it('identifies price reviews older than 180 days as stale', () => {
    // 181 days ago
    const days181 = new Date('2026-05-15T12:00:00.000Z');
    const res181 = computePriceAge(days181, referenceNow);
    assert.equal(res181.isOlderThan180Days, true);
    assert.equal(res181.status, 'stale');
    assert.ok(res181.daysAgo > 180);

    // 1 year ago
    const oneYearAgo = new Date('2025-11-12T12:00:00.000Z');
    const resYear = computePriceAge(oneYearAgo, referenceNow);
    assert.equal(resYear.isOlderThan180Days, true);
    assert.equal(resYear.status, 'stale');
    assert.match(resYear.formattedDate, /Nov 12, 2025/);
  });

  it('handles future review dates gracefully', () => {
    const futureDate = new Date('2026-12-01T12:00:00.000Z');
    const resFuture = computePriceAge(futureDate, referenceNow);
    assert.equal(resFuture.isOlderThan180Days, false);
    assert.equal(resFuture.status, 'future');
    assert.ok(resFuture.daysAgo < 0);
  });
});

