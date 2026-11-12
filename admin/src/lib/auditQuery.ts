export interface AuditFilterParams {
  actor?: string | null;
  action?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number | null;
  cursor?: string | null;
}

/**
 * Validates a date string.
 * Returns true if the string represents a valid, parseable date.
 */
export function isValidDateString(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const timestamp = Date.parse(value);
  return !isNaN(timestamp);
}

/**
 * Builds the URL query string for GET /admin/audit.
 * - Drops empty, null, undefined, or whitespace-only values.
 * - Encodes special characters cleanly via URLSearchParams.
 * - Rejects invalid dates by throwing an Error.
 *
 * @param filters AuditFilterParams object
 * @returns Formatted query string (e.g. "?actor=foo%40bar.com&limit=50") or ""
 * @throws Error if from or to contains an invalid date
 */
export function buildAuditQuery(filters: AuditFilterParams | null | undefined): string {
  if (!filters || typeof filters !== 'object') {
    return '';
  }

  const params = new URLSearchParams();

  // String fields
  const stringKeys: (keyof Pick<AuditFilterParams, 'actor' | 'action' | 'targetType' | 'targetId' | 'cursor'>)[] = [
    'actor',
    'action',
    'targetType',
    'targetId',
    'cursor',
  ];

  for (const key of stringKeys) {
    const val = filters[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      params.set(key, val.trim());
    }
  }

  // Date fields: validate and reject invalid dates
  if (filters.from && typeof filters.from === 'string' && filters.from.trim().length > 0) {
    const cleanFrom = filters.from.trim();
    if (!isValidDateString(cleanFrom)) {
      throw new Error(`Invalid date provided for "from": "${cleanFrom}"`);
    }
    params.set('from', cleanFrom);
  }

  if (filters.to && typeof filters.to === 'string' && filters.to.trim().length > 0) {
    const cleanTo = filters.to.trim();
    if (!isValidDateString(cleanTo)) {
      throw new Error(`Invalid date provided for "to": "${cleanTo}"`);
    }
    params.set('to', cleanTo);
  }

  // Limit field
  if (typeof filters.limit === 'number' && !isNaN(filters.limit) && filters.limit > 0) {
    const cappedLimit = Math.min(100, Math.floor(filters.limit));
    params.set('limit', String(cappedLimit));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

