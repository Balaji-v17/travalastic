/**
 * Foreign exchange rates service using Frankfurter (ECB reference rates).
 * Provides supported currencies list and INR conversion rates.
 */

export class FxProviderUnavailableError extends Error {
  constructor(message = 'FX rate provider is currently unavailable') {
    super(message);
    this.name = 'FxProviderUnavailableError';
    this.isFxUnavailable = true;
  }
}

const DEFAULT_BASE_URL = 'https://api.frankfurter.dev/v1';

export function getBaseUrl() {
  const url = (process.env.FX_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  return url.endsWith('/v1') ? url : `${url}/v1`;
}

// In-memory caches
let currenciesCache = {
  data: null,
  expiresAt: 0,
};

const ratesCache = new Map();

const CURRENCIES_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATES_TTL_MS = 12 * 60 * 60 * 1000;      // 12 hours
const FETCH_TIMEOUT_MS = 5000;                  // 5 seconds

/**
 * Returns the list of supported currency codes, cached for 24 hours.
 * @returns {Promise<string[]>}
 */
export async function getSupportedCurrencies() {
  const now = Date.now();
  if (currenciesCache.data && currenciesCache.expiresAt > now) {
    return currenciesCache.data;
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/currencies`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const codes = Object.keys(data).map((c) => c.toUpperCase());
    currenciesCache = {
      data: codes,
      expiresAt: now + CURRENCIES_TTL_MS,
    };
    return codes;
  } catch (err) {
    if (currenciesCache.data) {
      return currenciesCache.data;
    }
    throw new FxProviderUnavailableError(`Failed to fetch supported currencies: ${err.message}`);
  }
}

/**
 * Returns INR per 1 unit of `code`, as { inrPerUnit, rateDate, source: "ecb" }.
 * INR returns 1.
 * Caches each code for 12 hours. Only calls provider for codes in the supported list.
 *
 * @param {string} code - 3-letter currency code
 * @returns {Promise<{ inrPerUnit: number, rateDate: string, source: 'ecb' } | null>}
 */
export async function getInrRate(code) {
  if (!code || typeof code !== 'string') return null;
  const upperCode = code.trim().toUpperCase();

  // INR returns 1
  if (upperCode === 'INR') {
    const today = new Date().toISOString().split('T')[0];
    return {
      inrPerUnit: 1,
      rateDate: today,
      source: 'ecb',
    };
  }

  // Only call provider for codes in the supported list
  const supported = await getSupportedCurrencies();
  if (!supported.includes(upperCode)) {
    return null;
  }

  // Cache lookup
  const now = Date.now();
  const cached = ratesCache.get(upperCode);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/latest?from=${encodeURIComponent(upperCode)}&to=INR`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    const inrPerUnit = json.rates?.INR;
    if (typeof inrPerUnit !== 'number' || !Number.isFinite(inrPerUnit)) {
      throw new Error('Invalid rate returned by provider');
    }

    const rateResult = {
      inrPerUnit,
      rateDate: json.date, // Provider returns the official rate date (weekends return last business day)
      source: 'ecb',
    };

    ratesCache.set(upperCode, {
      data: rateResult,
      expiresAt: now + RATES_TTL_MS,
    });

    return rateResult;
  } catch (err) {
    if (cached) {
      return cached.data;
    }
    throw new FxProviderUnavailableError(`Failed to fetch INR rate for ${upperCode}: ${err.message}`);
  }
}

/**
 * Pure function: converts foreign currency amount to INR using fxRate.
 * amountINR = Math.round(originalAmount * fxRate * 100) / 100, rounded once at the end.
 *
 * @param {number|Object} originalAmount - Foreign amount or legacy expense object
 * @param {number} [fxRate] - Rate (₹ per 1 unit of foreign currency)
 * @returns {number} amount in INR
 */
export function toInr(originalAmount, fxRate) {
  // Support legacy expense objects without new fields: { amountINR: X }
  if (typeof originalAmount === 'object' && originalAmount !== null) {
    const exp = originalAmount;
    if (exp.originalAmount == null && exp.amountINR != null) {
      return exp.amountINR;
    }
    return toInr(
      exp.originalAmount != null ? exp.originalAmount : exp.amountINR,
      exp.fxRate != null ? exp.fxRate : 1
    );
  }

  if (typeof originalAmount !== 'number' || !Number.isFinite(originalAmount) || originalAmount <= 0) {
    throw new RangeError('originalAmount must be a finite positive number');
  }

  // Reject more than 2 decimal places
  const str = originalAmount.toString();
  if (str.includes('.')) {
    const dec = str.split('.')[1];
    if (dec && dec.length > 2) {
      throw new RangeError('originalAmount must have at most 2 decimal places');
    }
  }

  // INR passthrough when fxRate is omitted or 1
  if (fxRate === undefined || fxRate === null || fxRate === 1) {
    return Math.round(originalAmount * 100) / 100;
  }

  if (
    typeof fxRate !== 'number' ||
    !Number.isFinite(fxRate) ||
    fxRate <= 0.000001 ||
    fxRate >= 1000000
  ) {
    throw new RangeError('fxRate must be a finite number between 0.000001 and 1000000');
  }

  return Math.round(originalAmount * fxRate * 100) / 100;
}

// For unit testing: helpers to manipulate cache
export function _clearFxCache() {
  currenciesCache = { data: null, expiresAt: 0 };
  ratesCache.clear();
}

export function _setCurrenciesCache(codes, ttlMs = CURRENCIES_TTL_MS) {
  currenciesCache = {
    data: codes.map((c) => c.toUpperCase()),
    expiresAt: Date.now() + ttlMs,
  };
}

export function _setRateCache(code, data, ttlMs = RATES_TTL_MS) {
  ratesCache.set(code.toUpperCase(), {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

