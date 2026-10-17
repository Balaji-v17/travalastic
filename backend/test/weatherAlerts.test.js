import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeRainBuckets,
  matchesSuggestedTimeBucket,
  RAIN_LIKELY_THRESHOLD,
} from '../src/services/weatherAlerts.js';

describe('weatherAlerts - computeRainBuckets', () => {
  const targetDateStr = '2026-10-12';

  // Helper to construct a UTC unix timestamp (seconds) for 2026-10-12 at given UTC hour/minute
  const makeUtcDt = (hour, minute = 0) => {
    return Math.floor(Date.UTC(2026, 9, 12, hour, minute, 0) / 1000);
  };

  it('verifies RAIN_LIKELY_THRESHOLD constant is set to 0.5', () => {
    assert.strictEqual(RAIN_LIKELY_THRESHOLD, 0.5);
  });

  // Case 1: Rain only in the afternoon
  it('case 1: rain only in the afternoon', () => {
    const forecastItems = [
      { dt: makeUtcDt(6, 0), pop: 0.1 },  // Morning (06:00)
      { dt: makeUtcDt(9, 0), pop: 0.2 },  // Morning (09:00)
      { dt: makeUtcDt(12, 0), pop: 0.7 }, // Afternoon (12:00)
      { dt: makeUtcDt(15, 0), pop: 0.65 },// Afternoon (15:00)
      { dt: makeUtcDt(18, 0), pop: 0.1 }, // Evening (18:00)
      { dt: makeUtcDt(21, 0), pop: 0.0 }, // Night (21:00)
    ];

    // Local now is 08:00 on the same date (morning)
    const nowUtc = new Date(Date.UTC(2026, 9, 12, 8, 0, 0));
    const offsetSeconds = 0; // UTC

    const result = computeRainBuckets(forecastItems, offsetSeconds, nowUtc, targetDateStr);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].bucket, 'Afternoon');
    assert.strictEqual(result[0].probabilityPercent, 70);
  });

  // Case 2: Rain that has already ended
  it('case 2: rain that has already ended', () => {
    const forecastItems = [
      { dt: makeUtcDt(9, 0), pop: 0.85 }, // Morning (09:00, max pop 85%)
      { dt: makeUtcDt(12, 0), pop: 0.2 }, // Afternoon (12:00, below threshold)
      { dt: makeUtcDt(15, 0), pop: 0.3 }, // Afternoon (15:00, below threshold)
      { dt: makeUtcDt(18, 0), pop: 0.1 }, // Evening (18:00, below threshold)
    ];

    // Local now is 14:00 (afternoon). Morning ended at 12:00 local time!
    const nowUtc = new Date(Date.UTC(2026, 9, 12, 14, 0, 0));
    const offsetSeconds = 0;

    const result = computeRainBuckets(forecastItems, offsetSeconds, nowUtc, targetDateStr);

    // Morning had 85% rain, but it has already ended! So it must be dropped.
    assert.strictEqual(result.length, 0);
  });

  // Case 3: No rain
  it('case 3: no rain across any bucket', () => {
    const forecastItems = [
      { dt: makeUtcDt(6, 0), pop: 0.1 },
      { dt: makeUtcDt(9, 0), pop: 0.2 },
      { dt: makeUtcDt(12, 0), pop: 0.4 },
      { dt: makeUtcDt(15, 0), pop: 0.49 },
      { dt: makeUtcDt(18, 0), pop: 0.1 },
      { dt: makeUtcDt(21, 0), pop: 0.0 },
    ];

    const nowUtc = new Date(Date.UTC(2026, 9, 12, 6, 0, 0));
    const offsetSeconds = 0;

    const result = computeRainBuckets(forecastItems, offsetSeconds, nowUtc, targetDateStr);

    assert.strictEqual(result.length, 0);
  });

  // Case 4: A timezone offset that moves an entry into a different bucket
  it('case 4: a timezone offset that moves an entry into a different bucket', () => {
    // Forecast item at UTC 10:00 (pop = 0.8)
    const forecastItems = [
      { dt: makeUtcDt(10, 0), pop: 0.8 },
    ];

    // Subcase 4A: UTC offset = 0
    // Local time is 10:00 -> Morning (06:00 - 11:59)
    const nowUtcA = new Date(Date.UTC(2026, 9, 12, 6, 0, 0));
    const resultUtc = computeRainBuckets(forecastItems, 0, nowUtcA, targetDateStr);

    assert.strictEqual(resultUtc.length, 1);
    assert.strictEqual(resultUtc[0].bucket, 'Morning');
    assert.strictEqual(resultUtc[0].probabilityPercent, 80);

    // Subcase 4B: IST offset = +19800 (+5:30)
    // UTC 10:00 + 5:30 = local 15:30 -> Afternoon (12:00 - 16:59)!
    // Local now is 11:00 local time (which is UTC 05:30)
    const nowUtcB = new Date(Date.UTC(2026, 9, 12, 5, 30, 0));
    const resultIst = computeRainBuckets(forecastItems, 19800, nowUtcB, targetDateStr);

    assert.strictEqual(resultIst.length, 1);
    assert.strictEqual(resultIst[0].bucket, 'Afternoon');
    assert.strictEqual(resultIst[0].probabilityPercent, 80);
  });

  // Case 5: Exactly at the threshold (0.5)
  it('case 5: exactly at the threshold of 0.5', () => {
    const forecastItems = [
      { dt: makeUtcDt(14, 0), pop: 0.5 }, // Exactly 0.5 in afternoon
    ];

    const nowUtc = new Date(Date.UTC(2026, 9, 12, 8, 0, 0));
    const offsetSeconds = 0;

    const result = computeRainBuckets(forecastItems, offsetSeconds, nowUtc, targetDateStr);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].bucket, 'Afternoon');
    assert.strictEqual(result[0].probabilityPercent, 50);
  });
});

describe('weatherAlerts - matchesSuggestedTimeBucket', () => {
  it('matches textual bucket names', () => {
    assert.strictEqual(matchesSuggestedTimeBucket('Morning', 'Morning'), true);
    assert.strictEqual(matchesSuggestedTimeBucket('Early morning walk', 'Morning'), true);
    assert.strictEqual(matchesSuggestedTimeBucket('Afternoon Safari', 'Afternoon'), true);
    assert.strictEqual(matchesSuggestedTimeBucket('Sunset in Evening', 'Evening'), true);
    assert.strictEqual(matchesSuggestedTimeBucket('Late night dinner', 'Night'), true);
    assert.strictEqual(matchesSuggestedTimeBucket('Morning', 'Afternoon'), false);
  });

  it('matches clock times to buckets', () => {
    assert.strictEqual(matchesSuggestedTimeBucket('10:00 AM', 'Morning'), true);
    assert.strictEqual(matchesSuggestedTimeBucket('10:00 AM', 'Afternoon'), false);
    assert.strictEqual(matchesSuggestedTimeBucket('2:30 PM', 'Afternoon'), true);
    assert.strictEqual(matchesSuggestedTimeBucket('14:30', 'Afternoon'), true);
    assert.strictEqual(matchesSuggestedTimeBucket('6:00 PM', 'Evening'), true);
    assert.strictEqual(matchesSuggestedTimeBucket('9:30 PM', 'Night'), true);
  });
});

