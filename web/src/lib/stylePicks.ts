// Pure helpers for matching editorial style collection picks with destination trending results.

import { apiFetch } from './api.ts';

export function normalizeName(s?: string | null): string {
  if (!s || typeof s !== 'string') return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PickMatchCandidate {
  name?: string | null;
  type?: string | null;
  category?: string | null;
  city?: string | null;
  destination?: string | null;
}

const ATTRACTION_TYPE_KEYWORDS = [
  'valley',
  'lake',
  'suspension bridge',
  'bridge',
  'ski resort',
  'resort',
  'monastery',
  'waterfall',
  'falls',
  'fort',
  'palace',
  'temple',
  'temples',
  'museum',
  'museums',
  'park',
  'monument',
  'war memorial',
  'theme park',
  'observatory',
  'market',
  'stepwell',
  'zoo',
  'church',
  'mosque',
  'gurudwara',
  'shrine',
  'wildlife',
  'sanctuary',
  'attraction',
  'point',
  'viewpoint',
  'pass',
  'scenic area',
  'nearby location',
];

export function isAttractionType(type?: string | null): boolean {
  if (!type || typeof type !== 'string') return false;
  const lower = type.trim().toLowerCase();
  if (lower === 'destination' || lower === 'city' || lower === 'region') {
    return false;
  }
  return ATTRACTION_TYPE_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Validates whether a candidate record represents the curated destination pick.
 * - Rejects any attraction-typed record (e.g. "Solang Valley", "Laxman Jhula").
 * - Requires exact normalized-name match against the destination record's name.
 * - Never matches by city or parent destination.
 */
export function pickMatches(
  pick: string,
  result?: PickMatchCandidate | null
): boolean {
  if (!pick || typeof pick !== 'string' || !result || typeof result !== 'object') {
    return false;
  }
  const normPick = normalizeName(pick);
  if (!normPick) return false;

  // Reject attraction-typed records
  if (isAttractionType(result.type) || isAttractionType(result.category)) {
    return false;
  }

  // Exact normalized-name match against candidate's name only
  if (typeof result.name === 'string' && result.name) {
    const normName = normalizeName(result.name);
    if (normName === normPick) {
      return true;
    }
  }

  return false;
}

export interface TrendingDestinationRecord {
  id?: string;
  name: string;
  photoUrl?: string;
  photographerName?: string;
  photographerUrl?: string;
  country?: string;
  state?: string;
  region?: string;
  type?: string;
  category?: string;
}

// In-memory session cache keyed by normalized pick name, including negative results (null)
export const sessionPickCache = new Map<string, TrendingDestinationRecord | null>();

export function clearSessionPickCache(): void {
  sessionPickCache.clear();
}

export interface StylePickApiItem {
  name: string;
  imageQuery?: string | null;
}

export interface StyleCollectionApiResponse {
  key: string;
  picks: StylePickApiItem[];
  version: number;
}

/**
 * Fetches style collection picks from public API: GET /styles/:key
 */
export async function fetchStylePicks(
  key: string,
  options?: { signal?: AbortSignal; fetchFn?: (url: string, opts?: any) => Promise<any> }
): Promise<StylePickApiItem[]> {
  const fetcher = options?.fetchFn || apiFetch;
  const res = await fetcher<StyleCollectionApiResponse>(`/styles/${encodeURIComponent(key)}`, {
    signal: options?.signal,
  });
  return Array.isArray(res?.picks) ? res.picks : [];
}

export interface ResolvePickOptions {
  signal?: AbortSignal;
  fetchFn?: (url: string, options?: { signal?: AbortSignal }) => Promise<TrendingDestinationRecord[]>;
  imageQuery?: string | null;
}

/**
 * Resolves a curated destination pick using GET /destinations/trending?query=<imageQuery ?? name>.
 * Uses session-level in-memory caching (including negative results) to protect Pexels quota.
 */
export async function resolveDestinationPick(
  pick: string | StylePickApiItem,
  options?: ResolvePickOptions
): Promise<TrendingDestinationRecord | null> {
  const pickName = typeof pick === 'string' ? pick : pick?.name || '';
  const imageQuery = (typeof pick !== 'string' && pick?.imageQuery) ? pick.imageQuery : options?.imageQuery;
  const normPick = normalizeName(pickName);
  if (!normPick) return null;

  if (sessionPickCache.has(normPick)) {
    return sessionPickCache.get(normPick) ?? null;
  }

  const queryToUse = (imageQuery && imageQuery.trim()) ? imageQuery.trim() : pickName;

  try {
    let list: TrendingDestinationRecord[];
    if (options?.fetchFn) {
      list = await options.fetchFn(`/destinations/trending?query=${encodeURIComponent(queryToUse)}`, {
        signal: options.signal,
      });
    } else {
      list = await apiFetch<TrendingDestinationRecord[]>(
        `/destinations/trending?query=${encodeURIComponent(queryToUse)}`,
        { signal: options?.signal }
      );
    }

    if (!Array.isArray(list) || list.length === 0) {
      sessionPickCache.set(normPick, null);
      return null;
    }

    const matched =
      list.find((item) => pickMatches(queryToUse, item)) ||
      list.find((item) => pickMatches(pickName, item)) ||
      (imageQuery ? list.find((item) => !isAttractionType(item.type) && !isAttractionType(item.category)) : null);

    if (matched) {
      sessionPickCache.set(normPick, matched);
      return matched;
    }

    // Negative cache if no exact destination match was found
    sessionPickCache.set(normPick, null);
    return null;
  } catch (err: any) {
    if (err?.name === 'AbortError' || options?.signal?.aborted) {
      throw err;
    }
    // Negative cache on network failure to prevent re-querying in the same session
    sessionPickCache.set(normPick, null);
    return null;
  }
}

/**
 * Limits concurrent promise executions to avoid spiking the backend or third-party APIs.
 * Defaults to concurrency = 3 as requested.
 */
export async function limitConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 3
): Promise<Array<PromiseSettledResult<T>>> {
  if (!tasks || tasks.length === 0) return [];
  const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const currentIndex = nextIndex++;
      try {
        const value = await tasks[currentIndex]();
        results[currentIndex] = { status: 'fulfilled', value };
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), tasks.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
  return results;
}
