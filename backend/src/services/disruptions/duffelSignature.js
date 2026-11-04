import crypto from 'crypto';

/**
 * Verifies Duffel webhook HMAC-SHA256 signature against the raw request body.
 *
 * Header format: X-Duffel-Signature: t=<timestamp>,v1=<hex>[,v1=<hex>...]
 * Signed string: `${t}.${rawBody}`
 *
 * @param {Object} params
 * @param {string|Buffer} params.rawBody - Raw request body (exact bytes as string or Buffer)
 * @param {string} params.header - X-Duffel-Signature header value
 * @param {string} params.secret - Duffel webhook secret
 * @param {number} [params.toleranceSeconds=0] - Maximum allowed timestamp age in seconds (0 = disabled)
 * @param {number} [params.now] - Current timestamp in seconds (defaults to Math.floor(Date.now() / 1000))
 * @returns {{ ok: true } | { ok: false, reason: 'missing_header' | 'malformed_header' | 'missing_secret' | 'bad_signature' | 'stale_timestamp' }}
 */
export function verifyDuffelSignature({
  rawBody,
  header,
  secret,
  toleranceSeconds = 0,
  now,
}) {
  // 1. Missing secret check
  if (!secret || typeof secret !== 'string') {
    return { ok: false, reason: 'missing_secret' };
  }

  // 2. Missing header check
  if (!header || typeof header !== 'string') {
    return { ok: false, reason: 'missing_header' };
  }

  // 3. Robust header parsing
  // Expected shape: t=1612345678,v1=52571869e7...[,v1=...]
  const parts = header.split(',');
  let t = null;
  const v1List = [];

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();

    if (key === 't') {
      t = val;
    } else if (key === 'v1') {
      if (val) {
        v1List.push(val);
      }
    }
  }

  // Must have both timestamp t and at least one v1 value
  if (!t || v1List.length === 0) {
    return { ok: false, reason: 'malformed_header' };
  }

  // Timestamp must be a numeric integer
  const timestampSec = parseInt(t, 10);
  if (!/^\d+$/.test(t) || isNaN(timestampSec)) {
    return { ok: false, reason: 'malformed_header' };
  }

  // 4. Timestamp tolerance check
  // Tolerance check is OFF by default (toleranceSeconds = 0).
  // Duffel's documentation does not state whether retried webhook deliveries
  // are re-signed with fresh timestamps. Rejecting older timestamps could
  // inadvertently drop legitimate retried events when network delay or retries occur.
  if (toleranceSeconds > 0) {
    const currentNow = typeof now === 'number' ? now : Math.floor(Date.now() / 1000);
    if (Math.abs(currentNow - timestampSec) > toleranceSeconds) {
      return { ok: false, reason: 'stale_timestamp' };
    }
  }

  // 5. Compute HMAC-SHA256 over t + "." + rawBody
  const rawStr = Buffer.isBuffer(rawBody)
    ? rawBody.toString('utf8')
    : rawBody != null
    ? String(rawBody)
    : '';

  const signedPayload = `${t}.${rawStr}`;
  const expectedHmacHex = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex')
    .toLowerCase();

  const expectedBuffer = Buffer.from(expectedHmacHex, 'utf8');

  // 6. Compare with crypto.timingSafeEqual on equal-length Buffers
  // Accept both lowercase and uppercase hex by normalizing candidate v1 to lowercase.
  let matched = false;
  for (const v1 of v1List) {
    const candidateHex = v1.toLowerCase();
    const candidateBuffer = Buffer.from(candidateHex, 'utf8');

    // Mismatch in buffer length must not throw error; fail candidate check immediately
    if (candidateBuffer.length === expectedBuffer.length) {
      if (crypto.timingSafeEqual(candidateBuffer, expectedBuffer)) {
        matched = true;
        break;
      }
    }
  }

  if (!matched) {
    return { ok: false, reason: 'bad_signature' };
  }

  return { ok: true };
}

export default {
  verifyDuffelSignature,
};

