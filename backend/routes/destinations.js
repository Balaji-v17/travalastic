import express from 'express';
import { searchPlaces } from '../services/placesService.js';
import { getPhotoForDestination } from '../services/pexelsService.js';
import embedText from '../services/embeddingService.js';
import findTaggedPlaces from '../services/overpassService.js';
import TouristPlace from '../models/TouristPlace.js';
import getWeatherForecast from '../services/weatherService.js';

const router = express.Router();

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

    // 2. If query is present: first check if it matches (fuzzy/substring, case-insensitive)
    // any cached trending destination's name — if so, return that one directly, no new Pexels call
    const curatedMatches = curated.filter((dest) => {
      const lowerName = dest.name.toLowerCase();
      return lowerName.includes(lowerQuery) || lowerQuery.includes(lowerName);
    });

    if (curatedMatches.length > 0) {
      return res.status(200).json(curatedMatches);
    }

    // 3. Check per-query cache for off-list queries
    const cachedQuery = trendingQueryCache.get(lowerQuery);
    if (cachedQuery && Date.now() < cachedQuery.expiresAt) {
      return res.status(200).json(cachedQuery.data);
    }

    // 4. If it matches nothing in the curated list: make a live call to getPhotoForDestination(query)
    // and return a single result for whatever was typed
    const photoInfo = await getPhotoForDestination(rawQuery);
    const singleResult = [
      {
        name: rawQuery,
        photoUrl: photoInfo.photoUrl,
        photographerName: photoInfo.photographerName,
        photographerUrl: photoInfo.photographerUrl,
      },
    ];

    // Cache that per-query result too (same style as the curated list)
    trendingQueryCache.set(lowerQuery, {
      data: singleResult,
      expiresAt: Date.now() + TWENTY_FOUR_HOURS_MS,
    });

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

/**
 * Executes the full Explore cascade for places in a destination:
 * Tier 1: TouristPlace regex fuzzy match
 * Tier 2: TouristPlace semantic vector search if < 3
 * Tier 3: Nominatim geocode + Overpass tagged-places query around destination coordinates if < 30
 * Caches and returns { results, destinations, availableCategories }
 *
 * @param {string} destinationQuery - Destination name (e.g. "Goa")
 * @returns {Promise<{ results: Array, destinations: Array, availableCategories: Array<string> }>}
 */
export const fetchExplorePlaces = async (destinationQuery) => {
  if (!destinationQuery || typeof destinationQuery !== 'string' || !destinationQuery.trim()) {
    return { results: [], destinations: [], availableCategories: [] };
  }

  const cleanQuery = destinationQuery.trim();
  const cacheKey = cleanQuery.toLowerCase();
  const cached = destinationResponseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // Tier 1: Search name, city, and state using a regex against the search query.
  const textRegex = new RegExp(cleanQuery, 'i');
  const filter = {
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
            numCandidates: 30,
            limit: 20,
          },
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
      return {
        ...rest,
        placeId,
        _id: tp._id,
        name: rest.name,
        address: `${rest.city}, ${rest.state}${rest.type ? ` • ${rest.type}` : ''}`,
        city: rest.city,
        state: rest.state,
        zone: rest.zone,
        type: rest.type,
        significance: rest.significance,
        rating: rest.googleRating,
        entranceFeeINR: rest.entranceFeeINR,
        timeNeededHours: rest.timeNeededHours,
        bestTimeToVisit: rest.bestTimeToVisit,
        category: category || null,
        lat,
        lon,
        latitude: lat,
        longitude: lon,
        isCurated: true,
        source: rest.score != null ? 'tourist_places_vector' : 'tourist_places',
      };
    });
  }

  // Tier 3: If processedResults has < 30 places, run Nominatim geocode + Overpass tagged-places query
  if (processedResults.length < 30) {
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

  res.set('Cache-Control', 'no-store');

  try {
    const payload = await fetchExplorePlaces(queryParam.trim());
    return res.status(200).json(payload);
  } catch (error) {
    console.error('Error in searchDestinations:', error.message);
    return res.status(502).json({
      error: error.message || 'Failed to fetch destinations',
    });
  }
};

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