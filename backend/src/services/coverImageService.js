import {
  getPhotoForDestination,
  getCuratedPhotoForDestination,
} from './pexelsService.js';

export const COVER_HIT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const COVER_MISS_TTL_MS = 30 * 60 * 1000; // 30 minutes for negative cache

// Keyed by normalized destination string (lowercase, collapsed whitespace)
const coverCache = new Map();
const inFlightLookups = new Map();

const cacheStats = {
  hits: 0,
  misses: 0,
  providerLookups: 0,
};

export function normalizeDestinationKey(destinationName) {
  if (typeof destinationName !== 'string') return '';
  return destinationName.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildDestinationImageQuery(destinationName) {
  const clean = typeof destinationName === 'string' ? destinationName.trim().replace(/\s+/g, ' ') : '';
  return clean ? `${clean} travel landscape` : '';
}

function isRealProviderResult(result) {
  if (!result || typeof result !== 'object') return false;
  if (result.echoed === true || result.isEchoOnly === true || result.echoOnly === true) {
    return false;
  }
  const url = typeof result.photoUrl === 'string' ? result.photoUrl.trim() : '';
  if (!/^https?:\/\//i.test(url)) return false;
  return true;
}

export function formatCoverImage(result, fetchedAt = new Date()) {
  if (!isRealProviderResult(result)) return null;
  const url = result.photoUrl.trim();
  const thumbUrl =
    typeof result.thumbUrl === 'string' && /^https?:\/\//i.test(result.thumbUrl.trim())
      ? result.thumbUrl.trim()
      : url;
  const photographer =
    typeof result.photographerName === 'string' && result.photographerName.trim()
      ? result.photographerName.trim()
      : 'Pexels Contributor';
  const photographerUrl =
    typeof result.photographerUrl === 'string' && /^https?:\/\//i.test(result.photographerUrl.trim())
      ? result.photographerUrl.trim()
      : 'https://www.pexels.com';
  const sourceUrl =
    typeof result.sourceUrl === 'string' && /^https?:\/\//i.test(result.sourceUrl.trim())
      ? result.sourceUrl.trim()
      : photographerUrl;

  return {
    url,
    thumbUrl,
    photographer,
    photographerUrl,
    sourceUrl,
    source: 'pexels',
    fetchedAt,
  };
}

/**
 * Looks up a verified Pexels cover image for a destination with:
 * - Server-side normalized destination cache (24h hits, 30m misses)
 * - In-flight request deduplication (N simultaneous requests -> 1 provider lookup)
 * - Curated preference & strict rejection of echoed/fake results
 */
export async function getCoverForDestination(destinationName, options = {}) {
  const cleanDest = typeof destinationName === 'string' ? destinationName.trim().replace(/\s+/g, ' ') : '';
  const cacheKey = normalizeDestinationKey(cleanDest);
  if (!cacheKey || cacheKey.length < 2) {
    return null;
  }

  const now = options.now ?? Date.now();
  const lookupFn = options.lookupFn || getPhotoForDestination;
  const curatedLookupFn = options.curatedLookupFn || getCuratedPhotoForDestination;

  // 1. Check server-side cache
  const cached = coverCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    cacheStats.hits++;
    return cached.value;
  }

  // 2. Deduplicate concurrent in-flight lookups for the same normalized destination
  if (inFlightLookups.has(cacheKey)) {
    cacheStats.hits++;
    return inFlightLookups.get(cacheKey);
  }

  const promise = (async () => {
    cacheStats.misses++;
    let resolved = null;

    // Prefer curated exact destination match if available and not bypassed
    const curated = curatedLookupFn(cleanDest);
    if (curated && isRealProviderResult(curated)) {
      resolved = formatCoverImage(curated, new Date(now));
    } else {
      cacheStats.providerLookups++;
      const imageQuery = buildDestinationImageQuery(cleanDest);
      const raw = await lookupFn(imageQuery, {
        fallback: false,
        ...options.lookupOptions,
      });

      if (isRealProviderResult(raw)) {
        resolved = formatCoverImage(raw, new Date(now));
      }
    }

    coverCache.set(cacheKey, {
      value: resolved,
      expiresAt: now + (resolved ? COVER_HIT_TTL_MS : COVER_MISS_TTL_MS),
    });

    return resolved;
  })();

  inFlightLookups.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightLookups.delete(cacheKey);
  }
}

export function getCoverCacheStats() {
  return {
    ...cacheStats,
    size: coverCache.size,
  };
}

export function clearCoverCacheForTests() {
  coverCache.clear();
  inFlightLookups.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.providerLookups = 0;
}

