export const DEFAULT_PREVIEW_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks whether a preview token has expired based on its receipt timestamp.
 * Handles fresh tokens, boundary at 5:00, and backwards clock skew safely.
 */
export function isTokenExpired(
  receivedAtMs?: number | null,
  nowMs: number = Date.now(),
  ttlMs: number = DEFAULT_PREVIEW_TTL_MS
): boolean {
  if (receivedAtMs === undefined || receivedAtMs === null || typeof receivedAtMs !== 'number' || isNaN(receivedAtMs)) {
    return true;
  }

  // Handle clock skew: if client clock jumps backwards, treat as not expired
  if (nowMs < receivedAtMs) {
    return false;
  }

  return nowMs - receivedAtMs >= ttlMs;
}

/**
 * Computes remaining seconds until preview token expiration, clamped at 0.
 */
export function getRemainingSeconds(
  receivedAtMs?: number | null,
  nowMs: number = Date.now(),
  ttlMs: number = DEFAULT_PREVIEW_TTL_MS
): number {
  if (receivedAtMs === undefined || receivedAtMs === null || typeof receivedAtMs !== 'number' || isNaN(receivedAtMs)) {
    return 0;
  }

  if (nowMs < receivedAtMs) {
    return Math.floor(ttlMs / 1000);
  }

  const elapsedMs = nowMs - receivedAtMs;
  const remainingMs = ttlMs - elapsedMs;

  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
}

/**
 * Formats seconds into MM:SS display.
 */
export function formatRemainingTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(safeSeconds / 60);
  const s = safeSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

