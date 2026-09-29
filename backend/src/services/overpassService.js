import dns from 'node:dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

// In-memory 7-day cache for Overpass API responses
const overpassCache = new Map();
export const OVERPASS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Periodic cleanup of expired entries
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of overpassCache.entries()) {
    if (now > entry.expiresAt) {
      overpassCache.delete(key);
    }
  }
}, 60 * 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Mapping of mobile category chips to OpenStreetMap tags
 */
export const CATEGORY_OSM_MAPPING = {
  temples: {
    tagQl: 'nwr["amenity"="place_of_worship"]["name"]',
    label: 'Temples',
  },
  beaches: {
    tagQl: 'nwr["natural"="beach"]["name"]',
    label: 'Beaches',
  },
  museums: {
    tagQl: 'nwr["tourism"="museum"]["name"]',
    label: 'Museums',
  },
  nightlife: {
    tagQl: 'nwr["amenity"~"^(bar|nightclub|pub)$"]["name"]',
    label: 'Nightlife',
  },
  hill_stations: {
    tagQl: 'nwr["natural"="peak"]["name"]; nwr["tourism"="viewpoint"]["name"]',
    label: 'Hill Stations',
  },
  waterfalls: {
    tagQl: 'nwr["waterway"="waterfall"]["name"]',
    label: 'Waterfalls',
  },
  wildlife_sanctuary: {
    tagQl: 'nwr["leisure"="nature_reserve"]["name"]',
    label: 'Wildlife Sanctuary',
  },
  forts: {
    tagQl: 'nwr["historic"~"^(fort|castle)$"]["name"]',
    label: 'Forts',
  },
  all: {
    tagQl: [
      'nwr["amenity"="place_of_worship"]["name"]',
      'nwr["natural"="beach"]["name"]',
      'nwr["tourism"="museum"]["name"]',
      'nwr["amenity"~"^(bar|nightclub|pub)$"]["name"]',
      'nwr["natural"="peak"]["name"]',
      'nwr["tourism"="viewpoint"]["name"]',
      'nwr["waterway"="waterfall"]["name"]',
      'nwr["leisure"="nature_reserve"]["name"]',
      'nwr["historic"~"^(fort|castle)$"]["name"]',
      'nwr["tourism"="attraction"]["name"]',
    ].join('; '),
    label: 'All Places',
  },
};

/**
 * Safety-net exclusion: drops police stations, bus stations, shops, and offices.
 * Permanent safety net to ensure commercial/civic/infrastructure amenities never surface as tourist activities.
 */
export function isExcludedElement(tags) {
  if (!tags) return false;
  if (tags.amenity === 'police') return true;
  if (tags.amenity === 'bus_station') return true;
  if (tags.shop && typeof tags.shop === 'string' && tags.shop.trim() !== '' && tags.shop !== 'no') return true;
  if (tags.office && typeof tags.office === 'string' && tags.office.trim() !== '' && tags.office !== 'no') return true;
  return false;
}

/**
 * Resolves normalized category key from raw string.
 */
export function resolveCategoryKey(category) {
  const norm = (category || '').toLowerCase().trim();
  if (!norm || norm === 'all' || norm === 'all places') return 'all';
  if (norm.startsWith('temple')) return 'temples';
  if (norm.startsWith('beach')) return 'beaches';
  if (norm.startsWith('museum')) return 'museums';
  if (norm.startsWith('nightlife')) return 'nightlife';
  if (norm.includes('hill') || norm.includes('peak') || norm.includes('viewpoint')) return 'hill_stations';
  if (norm.includes('waterfall')) return 'waterfalls';
  if (norm.includes('wildlife') || norm.includes('sanctuary')) return 'wildlife_sanctuary';
  if (norm.includes('fort') || norm.includes('castle')) return 'forts';
  return 'all';
}

/**
 * Derives normalized master category label from element tags.
 * Returns null if the tags do not map to one of the specific master categories.
 */
export function getOSMMasterCategory(tags) {
  if (!tags) return null;
  if (tags.amenity === 'place_of_worship') return 'Temples';
  if (tags.natural === 'beach') return 'Beaches';
  if (tags.tourism === 'museum') return 'Museums';
  if (tags.amenity === 'bar' || tags.amenity === 'nightclub' || tags.amenity === 'pub') return 'Nightlife';
  if (tags.natural === 'peak' || tags.tourism === 'viewpoint') return 'Hill Stations';
  if (tags.waterway === 'waterfall') return 'Waterfalls';
  if (tags.leisure === 'nature_reserve') return 'Wildlife Sanctuary';
  if (tags.historic === 'fort' || tags.historic === 'castle') return 'Forts';
  return null;
}

/**
 * Builds Overpass QL query string with 15km around filter and spatial bounding box.
 */
export function buildOverpassQuery(lat, lon, category) {
  const catKey = resolveCategoryKey(category);
  const mapping = CATEGORY_OSM_MAPPING[catKey] || CATEGORY_OSM_MAPPING.all;

  // Approximate 16km bounding box in degrees for spatial indexing pruning
  const deltaLat = 16000 / 111000;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const deltaLon = 16000 / (111000 * (cosLat > 0.01 ? cosLat : 1));

  const south = (lat - deltaLat).toFixed(4);
  const north = (lat + deltaLat).toFixed(4);
  const west = (lon - deltaLon).toFixed(4);
  const east = (lon + deltaLon).toFixed(4);

  const statements = mapping.tagQl
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `  ${s}(around:15000,${lat},${lon});`)
    .join('\n');

  return `[out:json][timeout:15][bbox:${south},${west},${north},${east}];
(
${statements}
);
out center 20;`;
}

/**
 * Derives user-facing category label from element tags.
 */
function getTagCategory(tags, defaultLabel) {
  if (!tags) return defaultLabel;
  if (tags.natural === 'beach') return 'Beach';
  if (tags.tourism === 'museum') return 'Museum';
  if (tags.amenity === 'place_of_worship') return 'Place of Worship';
  if (tags.waterway === 'waterfall') return 'Waterfall';
  if (tags.natural === 'peak') return 'Mountain Peak';
  if (tags.tourism === 'viewpoint') return 'Viewpoint';
  if (tags.historic) return 'Historic Site';
  if (tags.leisure === 'park' || tags.natural === 'park') return 'Park';
  if (tags.amenity === 'bar') return 'Bar';
  if (tags.amenity === 'nightclub') return 'Nightclub';
  if (tags.amenity === 'pub') return 'Pub';
  if (tags.tourism === 'attraction') return 'Attraction';
  return defaultLabel;
}

/**
 * Queries Overpass API for tag-filtered places near lat/lon.
 * Caches results per (destination/coordinates + category) for 7 days.
 *
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} [category] - Category chip (e.g. Temples, Beaches, Museums, Nightlife, Nature)
 * @param {string} [destinationHint] - Optional destination name to key the cache
 * @returns {Promise<Array<{name: string, lat: number, lon: number, category: string}>>}
 */
export async function findTaggedPlaces(lat, lon, category, destinationHint = '') {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
    return [];
  }

  const catKey = resolveCategoryKey(category);
  const cacheKey = destinationHint
    ? `${destinationHint.trim().toLowerCase()}::${catKey}`
    : `${lat.toFixed(3)},${lon.toFixed(3)}::${catKey}`;

  // 1. Check 7-day in-memory cache
  const cached = overpassCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const query = buildOverpassQuery(lat, lon, catKey);
  const mapping = CATEGORY_OSM_MAPPING[catKey] || CATEGORY_OSM_MAPPING.all;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'User-Agent': 'Travalastic/1.0 (contact: https://github.com/travalastic/travalastic)',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Overpass API responded with HTTP ${response.status}: ${errText.slice(0, 100)}`);
    }

    const data = await response.json();
    const elements = Array.isArray(data?.elements) ? data.elements : [];

    const results = [];
    const seenNames = new Set();

    for (const el of elements) {
      const name = el.tags?.name?.trim();
      if (!name) continue;

      // Temporary diagnostic logging: log full raw tag set from Overpass response
      console.log(`[Overpass Tag Diagnostic] "${name}" (OSM ${el.type} #${el.id}):`, JSON.stringify(el.tags));

      // Permanent safety-net exclusion: drop police stations, bus stations, shops, and offices
      if (isExcludedElement(el.tags)) {
        console.log(`[Overpass Safety-Net Exclusion] Dropped "${name}" due to excluded tags:`, JSON.stringify(el.tags));
        continue;
      }

      if (seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());

      const placeLat = el.lat != null ? el.lat : el.center?.lat;
      const placeLon = el.lon != null ? el.lon : el.center?.lon;
      if (placeLat == null || placeLon == null) continue;

      const derivedCategory = getOSMMasterCategory(el.tags);

      results.push({
        name,
        lat: placeLat,
        lon: placeLon,
        category: derivedCategory,
        rawType: el.tags?.tourism || el.tags?.amenity || el.tags?.natural || el.tags?.historic || null,
      });
    }

    // Save to 7-day cache
    overpassCache.set(cacheKey, {
      data: results,
      expiresAt: Date.now() + OVERPASS_CACHE_TTL_MS,
    });

    return results;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export default findTaggedPlaces;
export { overpassCache };
