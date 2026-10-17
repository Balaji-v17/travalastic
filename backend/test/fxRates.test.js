import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  toInr,
  getInrRate,
  getSupportedCurrencies,
  FxProviderUnavailableError,
  _clearFxCache,
  _setCurrenciesCache,
} from '../src/services/fxRates.js';

describe('fxRates - toInr pure function', () => {
  it('fixture: whole-number currencies (e.g. JPY, IDR)', () => {
    // 12,000 JPY at 0.57 = 6,840 INR
    assert.strictEqual(toInr(12000, 0.57), 6840);
    // 25,000 KRW at 0.061 = 1,525 INR
    assert.strictEqual(toInr(25000, 0.061), 1525);
    // 100 USD at 85.50 = 8,550 INR
    assert.strictEqual(toInr(100, 85.5), 8550);
  });

  it('fixture: a half-paisa rounding case', () => {
    // 1 unit at 10.005 => 1 * 10.005 * 100 = 1000.5 => Math.round is 1001 => 10.01 INR
    assert.strictEqual(toInr(1, 10.005), 10.01);
    // 3 units at 10.005 => 3 * 10.005 * 100 = 3001.5 => Math.round is 3002 => 30.02 INR
    assert.strictEqual(toInr(3, 10.005), 30.02);
  });

  it('fixture: bounds rejection', () => {
    // Rate <= 0.000001
    assert.throws(() => toInr(100, 0.000001), /between 0.000001 and 1000000/);
    assert.throws(() => toInr(100, 0.0000005), /between 0.000001 and 1000000/);
    assert.throws(() => toInr(100, 0), /between 0.000001 and 1000000/);
    assert.throws(() => toInr(100, -1), /between 0.000001 and 1000000/);

    // Rate >= 1000000
    assert.throws(() => toInr(100, 1000000), /between 0.000001 and 1000000/);
    assert.throws(() => toInr(100, 1000001), /between 0.000001 and 1000000/);
    assert.throws(() => toInr(100, Infinity), /between 0.000001 and 1000000/);
    assert.throws(() => toInr(100, NaN), /between 0.000001 and 1000000/);

    // Amount <= 0 or not finite
    assert.throws(() => toInr(0, 85), /originalAmount must be a finite positive number/);
    assert.throws(() => toInr(-10, 85), /originalAmount must be a finite positive number/);
    assert.throws(() => toInr(NaN, 85), /originalAmount must be a finite positive number/);

    // Amount with more than 2 decimal places
    assert.throws(() => toInr(10.555, 85), /at most 2 decimal places/);
    assert.throws(() => toInr(0.001, 85), /at most 2 decimal places/);
  });

  it('fixture: INR passthrough', () => {
    assert.strictEqual(toInr(500), 500);
    assert.strictEqual(toInr(500, 1), 500);
    assert.strictEqual(toInr(123.45), 123.45);
    assert.strictEqual(toInr(123.45, 1), 123.45);
  });

  it('fixture: old expenses without the new fields', () => {
    const legacyExpense1 = {
      description: 'Auto Rickshaw',
      amountINR: 150,
    };
    assert.strictEqual(toInr(legacyExpense1), 150);

    const legacyExpense2 = {
      description: 'Dinner in Tokyo',
      originalAmount: null,
      amountINR: 4200,
    };
    assert.strictEqual(toInr(legacyExpense2), 4200);

    const newExpense = {
      description: 'Lunch in Paris',
      originalAmount: 20,
      fxRate: 90.5,
    };
    assert.strictEqual(toInr(newExpense), 1810);
  });
});

describe('fxRates - getInrRate and getSupportedCurrencies', () => {
  beforeEach(() => {
    _clearFxCache();
  });

  it('INR returns 1 with ecb source and current date without network call', async () => {
    const rate = await getInrRate('INR');
    assert.ok(rate);
    assert.strictEqual(rate.inrPerUnit, 1);
    assert.strictEqual(rate.source, 'ecb');
    assert.match(rate.rateDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns null for an unsupported currency code without calling provider', async () => {
    _setCurrenciesCache(['USD', 'EUR', 'GBP']);
    const rate = await getInrRate('XYZ');
    assert.strictEqual(rate, null);
  });

  it('handles invalid input for getInrRate gracefully', async () => {
    assert.strictEqual(await getInrRate(null), null);
    assert.strictEqual(await getInrRate(''), null);
    assert.strictEqual(await getInrRate(123), null);
  });

  it('verifies FxProviderUnavailableError properties', () => {
    const err = new FxProviderUnavailableError('Network timeout');
    assert.strictEqual(err.name, 'FxProviderUnavailableError');
    assert.strictEqual(err.isFxUnavailable, true);
    assert.strictEqual(err.message, 'Network timeout');
  });
});

