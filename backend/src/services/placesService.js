// In-memory cache for queries (TTL: 5 minutes)
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Rate limiting: enforce minimum 1-second gap between Nominatim requests
const RATE_LIMIT_GAP_MS = 1000;
let lastRequestTime = 0;
let rateLimitQueue = Promise.resolve();

const throttledFetch = (url, options) => {
  return new Promise((resolve, reject) => {
    rateLimitQueue = rateLimitQueue
      .catch(() => {}) // Prevent previous rejections from breaking the queue
      .then(async () => {
        const now = Date.now();
        const elapsed = now - lastRequestTime;
        if (elapsed < RATE_LIMIT_GAP_MS) {
          await new Promise((r) => setTimeout(r, RATE_LIMIT_GAP_MS - elapsed));
        }
        lastRequestTime = Date.now();
        return fetch(url, options);
      })
      .then(resolve, reject);
  });
};

// Periodically clean up expired cache entries
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}, 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Searches OpenStreetMap Nominatim API for places matching query.
 * Enforces a 1-second gap between requests and caches results for 5 minutes.
 * @param {string} query - Location or destination search query
 * @returns {Promise<Array<{name: string, address: string|null, latitude: number|null, longitude: number|null}>>}
 */
export const searchPlaces = async (query) => {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const trimmedQuery = query.trim();
  const cacheKey = trimmedQuery.toLowerCase();

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmedQuery)}&format=jsonv2&addressdetails=1&limit=5`;

  let response;
  try {
    response = await throttledFetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Travalastic/1.0 (contact: https://github.com/travalastic/travalastic)',
        'Accept': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error contacting Nominatim API:', error.message);
    throw new Error('Failed to communicate with OpenStreetMap Nominatim API');
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('Nominatim API error response:', response.status, errorText);
    throw new Error('Failed to fetch destinations from OpenStreetMap Nominatim API');
  }

  const data = await response.json();
  const places = Array.isArray(data) ? data : [];

  const destinations = places.map((place) => ({
    name: place.name || (place.display_name ? place.display_name.split(',')[0].trim() : ''),
    address: place.display_name || null,
    latitude: place.lat != null ? parseFloat(place.lat) : null,
    longitude: place.lon != null ? parseFloat(place.lon) : null,
  }));

  // Cache the result for 5 minutes
  cache.set(cacheKey, {
    data: destinations,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return destinations;
};

export default searchPlaces;

