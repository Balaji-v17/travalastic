/**
 * Pure JWT expiration decoder for UX countdowns and auto sign-out warnings.
 * NOTE: Never rely on client-side decoded expiration for security enforcement;
 * the backend validates signatures, expiration, and database status on every request.
 */

function base64UrlDecode(str: string): string | null {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(base64);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64, 'base64').toString('utf8');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely decodes the expiration timestamp (Unix seconds) from a JWT payload.
 * Returns null if the token is malformed, non-base64, empty, or missing a numeric exp claim.
 *
 * @param token JWT string
 * @returns Unix timestamp in seconds, or null
 */
export function getJwtExpSeconds(token: string | null | undefined): number | null {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3 || !parts[1]) {
    return null;
  }

  const decodedJson = base64UrlDecode(parts[1]);
  if (!decodedJson) {
    return null;
  }

  try {
    const payload = JSON.parse(decodedJson);
    if (
      payload &&
      typeof payload === 'object' &&
      typeof payload.exp === 'number' &&
      !isNaN(payload.exp) &&
      payload.exp > 0
    ) {
      return payload.exp;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if a JWT is expired based on its client-decoded exp claim.
 *
 * @param token JWT string
 * @param bufferSeconds Optional safety margin in seconds (default: 0)
 * @returns boolean
 */
export function isJwtExpired(
  token: string | null | undefined,
  bufferSeconds: number = 0
): boolean {
  const exp = getJwtExpSeconds(token);
  if (exp === null) {
    return true;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= exp - bufferSeconds;
}

