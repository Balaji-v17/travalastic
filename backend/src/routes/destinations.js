import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { searchPlaces } from '../services/placesService.js';
import { getPhotoForDestination } from '../services/pexelsService.js';
import embedText from '../services/embeddingService.js';
import findTaggedPlaces from '../services/overpassService.js';
import TouristPlace from '../models/TouristPlace.js';
import City from '../models/City.js';
import Region from '../models/Region.js';
import { normalizeSearchKey, escapeRegex, levenshtein } from '../utils/cityNormalizer.js';
import getWeatherForecast from '../services/weatherService.js';

const router = express.Router();

export const citySearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Too many city search requests. Please slow down.' },
});

// Static list of 18 trending Indian destinations (fixed content)
export const TRENDING_DESTINATIONS = [
  'Goa',
  'Jaipur',
  'Kerala Backwaters',
  'Ladakh',
  'Rishikesh',
  'Udaipur',
  'Munnar',
  'Varanasi',
  'Manali',
  'Andaman Islands',
  'Hampi',
  'Mysore',
  'Darjeeling',
  'Puducherry',
  'Rann of Kutch',
  'Meghalaya',
  'Coorg',
  'Amritsar',
];

// Master mapping object from database "type" to normalized app categories
export const typeToCategoryMap = {
  'Beach': 'Beaches',
  'Museum': 'Museums',
  'Temple': 'Temples',
  'Temples': 'Temples',
  'Gurudwara': 'Temples',
  'Church': 'Temples',
  'Mosque': 'Temples',
  'Monastery': 'Temples',
  'Shrine': 'Temples',
  'Religious Complex': 'Temples',
  'Religious Site': 'Temples',
  'Spiritual Center': 'Temples',
  'National Park': 'Wildlife Sanctuary',
  'Wildlife Sanctuary': 'Wildlife Sanctuary',
  'Bird Sanctuary': 'Wildlife Sanctuary',
  'Waterfall': 'Waterfalls',
  'Hill': 'Hill Stations',
  'Mountain Peak': 'Hill Stations',
  'Viewpoint': 'Hill Stations',
  'Scenic Point': 'Hill Stations',
  'Fort': 'Forts',
  'Palace': 'Forts',
  'Historical': 'Forts',
};

/**
 * Maps a TouristPlace "type" string to normalized app category using typeToCategoryMap.
 * Returns null if not found.
 */
export function mapTypeToCategory(type) {
  if (!type || typeof type !== 'string') return null;
  const trimmed = type.trim();
  if (typeToCategoryMap[trimmed]) return typeToCategoryMap[trimmed];
  const lower = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(typeToCategoryMap)) {
    if (key.toLowerCase() === lower) return val;
  }
  return null;
}

// In-memory 24-hour cache for trending destinations
let trendingCache = null;
let trendingCacheExpiresAt = 0;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Per-query cache for off-list searches (same 24-hour TTL style)
const trendingQueryCache = new Map();

const ensureCuratedTrending = async () => {
  const now = Date.now();
  if (trendingCache && now < trendingCacheExpiresAt) {
    return trendingCache;
  }

  const results = await Promise.all(
    TRENDING_DESTINATIONS.map(async (name) => {
      const photoInfo = await getPhotoForDestination(name);
      return {
        name,
        photoUrl: photoInfo.photoUrl,
        photographerName: photoInfo.photographerName,
        photographerUrl: photoInfo.photographerUrl,
      };
    })
  );

  trendingCache = results;
  trendingCacheExpiresAt = now + TWENTY_FOUR_HOURS_MS;
  return results;
};

/**
 * Resolves photography for a destination query.
 * Reuses the 24-hour trending cache and per-query trending cache.
 *
 * @param {string} rawQuery - destination name or image query
 * @param {object} options
 * @param {boolean} [options.allowGenericFallback=true] - whether to return generic fallback if no real photo found
 * @returns {Promise<{ photoUrl: string, photographerName: string, photographerUrl: string } | null>}
 */
export async function resolveDestinationPhoto(rawQuery, { allowGenericFallback = true } = {}) {
  const cleanQuery = (rawQuery || '').trim();
  if (!cleanQuery) return null;

  const lowerQuery = cleanQuery.toLowerCase();
  const curated = await ensureCuratedTrending();

  // 1. Check curated trending list
  const curatedMatch = curated.find((dest) => {
    const lowerName = dest.name.toLowerCase();
    return lowerName.includes(lowerQuery) || lowerQuery.includes(lowerName);
  });

  if (curatedMatch && curatedMatch.photoUrl) {
    return {
      photoUrl: curatedMatch.photoUrl,
      photographerName: curatedMatch.photographerName,
      photographerUrl: curatedMatch.photographerUrl,
    };
  }

  // 2. Check per-query cache for off-list searches
  const cachedQuery = trendingQueryCache.get(lowerQuery);
  if (cachedQuery && Date.now() < cachedQuery.expiresAt) {
    const item = cachedQuery.data?.[0];
    if (item && item.photoUrl) {
      return {
        photoUrl: item.photoUrl,
        photographerName: item.photographerName,
        photographerUrl: item.photographerUrl,
      };
    }
  }

  // 3. Make live call to Pexels service
  const photoInfo = await getPhotoForDestination(cleanQuery, { fallback: allowGenericFallback });
  if (!photoInfo || !photoInfo.photoUrl) {
    return null;
  }

  const result = {
    photoUrl: photoInfo.photoUrl,
    photographerName: photoInfo.photographerName,
    photographerUrl: photoInfo.photographerUrl,
  };

  // Cache in the 24-hour per-query cache
  trendingQueryCache.set(lowerQuery, {
    data: [
      {
        name: cleanQuery,
        ...result,
      },
    ],
    expiresAt: Date.now() + TWENTY_FOUR_HOURS_MS,
  });

  return result;
}

const getTrendingDestinations = async (req, res) => {
  try {
    const rawQuery = (req.query.query || req.query.q || '').trim();

    // 1. If query is empty/absent: return the existing cached curated list, unchanged
    if (!rawQuery) {
      const curated = await ensureCuratedTrending();
      return res.status(200).json(curated);
    }

    const lowerQuery = rawQuery.toLowerCase();
    const curated = await ensureCuratedTrending();

    // 2. If query matches any curated trending destination, return curated matches
    const curatedMatches = curated.filter((dest) => {
      const lowerName = dest.name.toLowerCase();
      return lowerName.includes(lowerQuery) || lowerQuery.includes(lowerName);
    });

    if (curatedMatches.length > 0) {
      return res.status(200).json(curatedMatches);
    }

    // 3. Resolve photo using the shared 24-hour cache and service
    const resolved = await resolveDestinationPhoto(rawQuery, { allowGenericFallback: true });
    if (!resolved) {
      return res.status(200).json([]);
    }

    const singleResult = [
      {
        name: rawQuery,
        ...resolved,
      },
    ];

    return res.status(200).json(singleResult);
  } catch (error) {
    console.error('Error in getTrendingDestinations:', error.message);
    if (trendingCache) {
      return res.status(200).json(trendingCache);
    }
    return res.status(500).json({ error: 'Failed to fetch trending destinations' });
  }
};

// In-memory response cache with 5-minute TTL for search queries
export const destinationResponseCache = new Map();
export const DEST_CACHE_TTL_MS = 5 * 60 * 1000;

export const invalidateDestinationCache = () => {
  destinationResponseCache.clear();
};

/**
 * Executes the full Explore cascade for places in a destination:
 * Tier 1: TouristPlace regex fuzzy match
 * Tier 2: TouristPlace semantic vector search if < 3
 * Tier 3: Nominatim geocode + Overpass tagged-places query around destination coordinates if < 30
 * Caches and returns { results, destinations, availableCategories }
 *
 * @param {string} destinationQuery - Destination name (e.g. "Goa")
 * @returns {Promise<{ results: Array, destinations: Array, availableCategories: Array<string> }>}\n */
export const fetchExplorePlaces = async (destinationQuery, options = {}) => {
  if (!destinationQuery || typeof destinationQuery !== 'string' || !destinationQuery.trim()) {
    return { results: [], destinations: [], availableCategories: [], externalFallbackUsed: false };
  }

  const allowFallback = options.allowFallback !== false;
  const cleanQuery = destinationQuery.trim();
  const cacheKey = `${cleanQuery.toLowerCase()}::fb=${allowFallback ? '1' : '0'}`;
  const cached = destinationResponseCache.get(cacheKey);

  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // Tier 1: Search name, city, and state using a regex against the search query.
  // Must use hidden: { $ne: true } so legacy records lacking the field are included, but hidden places are excluded.
  const textRegex = new RegExp(cleanQuery, 'i');
  const filter = {
    hidden: { $ne: true },
    $or: [
      { name: textRegex },
      { city: textRegex },
      { state: textRegex },
    ],
  };

  let touristPlaceMatches = [];
  try {
    touristPlaceMatches = await TouristPlace.find(filter)
      .select('-embedding')
      .sort({ googleRating: -1 })
      .limit(30)
      .lean();
  } catch (dbErr) {
    console.warn('Tier 1 TouristPlace regex search failed:', dbErr.message);
    touristPlaceMatches = [];
  }

  // Tier 2: If Tier 1 yields < 3 results, run the semantic $vectorSearch cascade
  if (touristPlaceMatches.length < 3) {
    try {
      const descriptivePhrase = `${cleanQuery}, top tourist places, attractions and sightseeing highlights`;
      const queryEmbedding = await embedText(descriptivePhrase);

      const vectorIndexName = process.env.TOURIST_PLACES_VECTOR_INDEX || 'vector_index';
      const vectorResults = await TouristPlace.aggregate([
        {
          $vectorSearch: {
            index: vectorIndexName,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 60,
            limit: 40,
          },
        },
        {
          $match: {
            hidden: { $ne: true },
          },
        },
        {
          $limit: 20,
        },
        {
          $project: {
            name: 1,
            city: 1,
            state: 1,
            zone: 1,
            type: 1,
            significance: 1,
            googleRating: 1,
            entranceFeeINR: 1,
            timeNeededHours: 1,
            bestTimeToVisit: 1,
            heritage: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ]);

      if (Array.isArray(vectorResults) && vectorResults.length > 0) {
        const existingIds = new Set(touristPlaceMatches.map((m) => m._id?.toString()));
        for (const vr of vectorResults) {
          if (vr._id && !existingIds.has(vr._id.toString())) {
            touristPlaceMatches.push(vr);
            existingIds.add(vr._id.toString());
          }
        }
      }
    } catch (vectorErr) {
      console.warn('Tier 2 TouristPlace vector search failed, proceeding:', vectorErr.message);
    }
  }

  // Processing: Iterate over database results. Inject category field from typeToCategoryMap (fallback to null).
  let processedResults = [];
  if (touristPlaceMatches && touristPlaceMatches.length > 0) {
    processedResults = touristPlaceMatches.map((tp) => {
      const { embedding, ...rest } = tp;
      const category = mapTypeToCategory(rest.type);
      const placeId = (tp._id || '').toString();
      const lat = tp.lat ?? tp.latitude ?? null;
      const lon = tp.lon ?? tp.longitude ?? null;
      const addressParts = [rest.city, rest.state].filter(Boolean).join(', ');
      return {
        ...rest,
        placeId,
        _id: tp._id,
        name: rest.name,
        address: `${addressParts}${rest.type ? ` • ${rest.type}` : ''}`,
        city: rest.city,
        state: rest.state ?? null,
        zone: rest.zone ?? null,
        type: rest.type,
        significance: rest.significance ?? null,
        rating: rest.googleRating ?? null,
        googleRating: rest.googleRating ?? null,
        entranceFeeINR: rest.entranceFeeINR ?? null,
        timeNeededHours: rest.timeNeededHours ?? null,
        bestTimeToVisit: rest.bestTimeToVisit ?? null,
        heritage: rest.heritage || null,
        category: category || null,
        lat,
        lon,
        latitude: lat,
        longitude: lon,
        isCurated: true,
        source: rest.score != null ? 'tourist_places_vector' : (rest.source || 'tourist_places'),
      };
    });
  }

  // Tier 3: If allowed and processedResults has < 30 places, run Nominatim geocode + Overpass tagged-places query
  let externalFallbackUsed = false;
  if (allowFallback && processedResults.length < 30) {
    const fallbackNotice = "No curated activities found for this destination — here's what we found nearby";
    let rawPlaces = [];
    try {
      rawPlaces = await searchPlaces(cleanQuery, { countrycodes: 'in' });
    } catch (geoErr) {
      console.warn('Nominatim geocoding failed:', geoErr.message);
      rawPlaces = [];
    }

    if (rawPlaces.length > 0 && rawPlaces[0].latitude != null && rawPlaces[0].longitude != null) {
      const { latitude, longitude } = rawPlaces[0];
      try {
        const overpassPlaces = await findTaggedPlaces(latitude, longitude, 'all', cleanQuery);
        if (Array.isArray(overpassPlaces) && overpassPlaces.length > 0) {
          externalFallbackUsed = true;
          const existingNames = new Set(processedResults.map((p) => p.name.toLowerCase()));
          for (const op of overpassPlaces) {
            if (!existingNames.has(op.name.toLowerCase())) {
              const placeId = op.placeId || (op.osmType && op.osmId ? `${op.osmType}/${op.osmId}` : (op.id || null));
              processedResults.push({
                placeId,
                name: op.name,
                address: `${op.name}, ${cleanQuery}${op.category ? ` • ${op.category}` : ''}`,
                latitude: op.lat,
                longitude: op.lon,
                lat: op.lat,
                lon: op.lon,
                type: op.category || op.rawType || 'Attraction',
                category: op.category || null,
                source: 'overpass',
                isCurated: false,
                notice: processedResults.length === 0 ? fallbackNotice : undefined,
                fallbackNotice: processedResults.length === 0 ? fallbackNotice : undefined,
              });
              existingNames.add(op.name.toLowerCase());
            }
          }
        }
      } catch (overpassErr) {
        console.warn('Overpass query failed or timed out:', overpassErr.message);
      }
    }

    // Raw Nominatim fallback if still 0 places
    if (processedResults.length === 0 && rawPlaces.length > 0) {
      externalFallbackUsed = true;
      processedResults = rawPlaces.map((place) => ({
        placeId: place.latitude && place.longitude ? `geo/${place.latitude},${place.longitude}` : `place/${encodeURIComponent(place.name)}`,
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        lat: place.latitude,
        lon: place.longitude,
        source: 'nominatim',
        isCurated: false,
        notice: fallbackNotice,
        fallbackNotice: fallbackNotice,
        type: 'Nearby location',
        category: null,
      }));
    }
  }

  // Dynamic Derivation: Create a Set of all non-null category values actually present in the final processed results array
  const foundCategories = new Set(
    processedResults
      .map((item) => item.category)
      .filter((cat) => cat != null && cat !== '')
  );

  const payload = {
    results: processedResults,
    destinations: processedResults, // alias for backwards compatibility
    availableCategories: Array.from(foundCategories),
    externalFallbackUsed,
  };

  destinationResponseCache.set(cacheKey, {
    data: payload,
    expiresAt: Date.now() + DEST_CACHE_TTL_MS,
  });

  return payload;
};

const searchDestinations = async (req, res, next) => {
  const queryParam = req.query.q || req.query.query;

  if (!queryParam || typeof queryParam !== 'string' || !queryParam.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" or "query" is required' });
  }

  const fallbackParam = String(req.query.fallback ?? '1').trim().toLowerCase();
  const allowFallback = fallbackParam !== '0' && fallbackParam !== 'false';

  res.set('Cache-Control', 'no-store');

  try {
    const payload = await fetchExplorePlaces(queryParam.trim(), { allowFallback });
    return res.status(200).json(payload);
  } catch (error) {
    console.error('Error in searchDestinations:', error.message);
    return res.status(502).json({
      error: error.message || 'Failed to fetch destinations',
    });
  }
};

function comparePopulationNullsLast(a, b) {
  const popA = a.population;
  const popB = b.population;
  if (popA == null && popB == null) return 0;
  if (popA == null) return 1;
  if (popB == null) return -1;
  return popB - popA;
}

function formatCitySuggestion(doc) {
  return {
    id: String(doc.sourceId ?? doc.id ?? ''),
    name: doc.name,
    admin: doc.admin || '',
    country: doc.country,
    iso2: doc.iso2 || '',
    lat: doc.lat,
    lng: doc.lng,
    population: doc.population ?? null,
    type: 'city',
  };
}

function formatRegionSuggestion(doc) {
  return {
    id: `region:${String(doc.sourceKey ?? doc.id ?? '')}`,
    name: doc.name,
    admin: '',
    country: doc.country,
    iso2: doc.iso2 || '',
    lat: doc.lat,
    lng: doc.lng,
    population: null,
    type: 'region',
  };
}

/**
 * Combines city and region prefix matches, sorting cities by population desc (nulls last),
 * placing regions after cities, deduplicating identical display text, and capping at `limit`.
 */
export function mergeCityAndRegionSuggestions(cityDocs, regionDocs, limit) {
  const sortedCities = [...(cityDocs || [])].sort(comparePopulationNullsLast);
  const seenLabels = new Set();
  const cityNameCountryKeys = new Set();
  const dedupedCities = [];

  for (const doc of sortedCities) {
    if (!doc || !doc.name || !doc.country) continue;
    const item = formatCitySuggestion(doc);
    const labelKey = [
      normalizeSearchKey(item.name),
      normalizeSearchKey(item.admin),
      normalizeSearchKey(item.country),
    ].join('|');
    if (seenLabels.has(labelKey)) continue;
    seenLabels.add(labelKey);
    cityNameCountryKeys.add(`${normalizeSearchKey(item.name)}|${normalizeSearchKey(item.country)}`);
    dedupedCities.push(item);
  }

  const dedupedRegions = [];
  for (const doc of regionDocs || []) {
    if (!doc || !doc.name || !doc.country) continue;
    const item = formatRegionSuggestion(doc);
    const nameCountryKey = `${normalizeSearchKey(item.name)}|${normalizeSearchKey(item.country)}`;
    if (cityNameCountryKeys.has(nameCountryKey)) continue;
    const labelKey = `${normalizeSearchKey(item.name)}||${normalizeSearchKey(item.country)}`;
    if (seenLabels.has(labelKey)) continue;
    seenLabels.add(labelKey);
    dedupedRegions.push(item);
  }

  const regionReserve =
    limit >= 4
      ? Math.min(2, dedupedRegions.length)
      : dedupedCities.length === 0
        ? Math.min(limit, dedupedRegions.length)
        : 0;
  const maxCities = Math.max(0, limit - regionReserve);
  const selectedCities = dedupedCities.slice(0, maxCities);
  const remainingSlots = Math.max(0, limit - selectedCities.length);
  const selectedRegions = dedupedRegions.slice(0, remainingSlots);

  return [...selectedCities, ...selectedRegions];
}

/**
 * GET /destinations/cities?q=&limit=
 * Fast prefix autocomplete over our own City & Region collections.
 * No external HTTP calls, no query logging, strict min-length (2) and limit (1..10) clamps.
 */
export const searchCities = async (req, res, next) => {
  try {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const searchKey = normalizeSearchKey(rawQ);

    if (rawQ.length < 2 || searchKey.length < 2) {
      return res.status(400).json({ error: 'Query parameter "q" must be at least 2 characters' });
    }

    const parsedLimit = Number.parseInt(String(req.query.limit ?? '8'), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(10, Math.max(1, parsedLimit)) : 8;

    const prefixRegex = new RegExp('^' + escapeRegex(searchKey));

    const [cityDocs, regionDocs] = await Promise.all([
      City.find({ searchKey: prefixRegex })
        .select('sourceId name admin country iso2 lat lng population')
        .sort({ population: -1 })
        .limit(limit)
        .lean(),
      Region.find({ searchKey: prefixRegex })
        .select('sourceKey name country iso2 lat lng')
        .sort({ name: 1 })
        .limit(Math.min(limit, 5))
        .lean(),
    ]);

    const cities = mergeCityAndRegionSuggestions(cityDocs, regionDocs, limit);
    return res.status(200).json({ cities });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /destinations/check?q=
 * Checks whether a destination matches a City, Region, or TouristPlace (city/name).
 * If unknown, computes up to 3 closest city/region names via local edit distance (no external calls).
 */
export const checkDestinationKnown = async (req, res, next) => {
  try {
    const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const normQ = normalizeSearchKey(rawQ);

    if (rawQ.length < 2 || normQ.length < 2) {
      return res.status(200).json({ known: true, suggestions: [] });
    }

    const exactSearchKeyRegex = new RegExp('^' + escapeRegex(normQ) + '$');
    const exactRawRegex = new RegExp('^' + escapeRegex(rawQ) + '$', 'i');

    const [cityHit, regionHit, placeHit] = await Promise.all([
      City.findOne({ searchKey: exactSearchKeyRegex }).select('sourceId').lean(),
      Region.findOne({ searchKey: exactSearchKeyRegex }).select('sourceKey').lean(),
      TouristPlace.findOne({
        hidden: { $ne: true },
        $or: [{ city: exactRawRegex }, { name: exactRawRegex }],
      })
        .select('_id')
        .lean(),
    ]);

    if (cityHit || regionHit || placeHit) {
      return res.status(200).json({ known: true, suggestions: [] });
    }

    // Gather top prefix and inner-substring candidates locally for edit-distance ranking
    const prefix2 = normQ.slice(0, 2);
    const prefixRegex = new RegExp('^' + escapeRegex(prefix2));
    const midSlice = normQ.length >= 3 ? normQ.slice(1, Math.min(4, normQ.length)) : '';

    const queries = [
      City.find({ searchKey: prefixRegex })
        .select('sourceId name admin country iso2 lat lng population searchKey')
        .sort({ population: -1 })
        .limit(40)
        .lean(),
      Region.find({ searchKey: prefixRegex })
        .select('sourceKey name country iso2 lat lng searchKey')
        .limit(15)
        .lean(),
    ];

    if (midSlice && midSlice.length >= 2) {
      queries.push(
        City.find({ searchKey: new RegExp(escapeRegex(midSlice)) })
          .select('sourceId name admin country iso2 lat lng population searchKey')
          .sort({ population: -1 })
          .limit(40)
          .lean()
      );
    }

    const [prefixCities, prefixRegions, containsCities = []] = await Promise.all(queries);

    const candidateMap = new Map();
    for (const c of [...prefixCities, ...containsCities]) {
      if (!c || !c.name) continue;
      const key = `${c.searchKey || normalizeSearchKey(c.name)}|${normalizeSearchKey(c.country)}`;
      if (!candidateMap.has(key)) {
        candidateMap.set(key, {
          key: c.searchKey || normalizeSearchKey(c.name),
          population: c.population ?? null,
          item: formatCitySuggestion(c),
        });
      }
    }
    for (const r of prefixRegions) {
      if (!r || !r.name) continue;
      const key = `${r.searchKey || normalizeSearchKey(r.name)}|${normalizeSearchKey(r.country)}`;
      if (!candidateMap.has(key)) {
        candidateMap.set(key, {
          key: r.searchKey || normalizeSearchKey(r.name),
          population: null,
          item: formatRegionSuggestion(r),
        });
      }
    }

    const maxDist = Math.max(2, Math.floor(normQ.length * 0.5));
    const scored = [];
    for (const entry of candidateMap.values()) {
      const dist = levenshtein(normQ, entry.key);
      if (dist <= maxDist) {
        scored.push({ dist, population: entry.population, item: entry.item });
      }
    }

    scored.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return comparePopulationNullsLast(a, b);
    });

    const seenNames = new Set();
    const suggestions = [];
    for (const s of scored) {
      const nameKey = normalizeSearchKey(s.item.name);
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);
      suggestions.push(s.item);
      if (suggestions.length >= 3) break;
    }

    return res.status(200).json({ known: false, suggestions });
  } catch (error) {
    next(error);
  }
};

router.get('/cities', citySearchLimiter, searchCities);
router.get('/check', citySearchLimiter, checkDestinationKnown);
router.get('/trending', getTrendingDestinations);
router.get('/search', searchDestinations);

/**
 * GET /destinations/weather
 * Returns weather forecast for destination or coordinates via existing weatherService.
 */
router.get('/weather', async (req, res, next) => {
  try {
    const { lat, lon, latitude, longitude, date, destination } = req.query;
    let targetLat = lat || latitude;
    let targetLon = lon || longitude;

    if ((targetLat == null || targetLon == null) && destination) {
      const places = await searchPlaces(destination);
      if (places && places.length > 0 && places[0].latitude != null && places[0].longitude != null) {
        targetLat = places[0].latitude;
        targetLon = places[0].longitude;
      }
    }

    if (targetLat == null || targetLon == null) {
      return res.status(200).json({
        description: 'Weather data unavailable',
        temperature: 'N/A',
      });
    }

    const targetDate = date || new Date().toISOString().slice(0, 10);
    const forecast = await getWeatherForecast(targetLat, targetLon, targetDate);
    return res.status(200).json(forecast);
  } catch (error) {
    next(error);
  }
});

export default router;