import express from 'express';
import { searchPlaces } from '../services/placesService.js';
import { getPhotoForDestination } from '../services/pexelsService.js';
import embedText from '../services/embeddingService.js';
import findTaggedPlaces from '../services/overpassService.js';
import TouristPlace from '../models/TouristPlace.js';

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
const destinationResponseCache = new Map();
const DEST_CACHE_TTL_MS = 5 * 60 * 1000;

const searchDestinations = async (req, res, next) => {
  // Rely on q (or query) only; stop accepting category from req.query
  const queryParam = req.query.q || req.query.query;

  if (!queryParam || typeof queryParam !== 'string' || !queryParam.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" or "query" is required' });
  }

  res.set('Cache-Control', 'no-store');

  const destinationQuery = queryParam.trim();
  const cacheKey = destinationQuery.toLowerCase();
  const cached = destinationResponseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return res.status(200).json(cached.data);
  }

  try {
    // Tier 1: Search name, city, and state using a regex against the search query.
    // Increased limit to 20 to ensure a good spread of categories without category filtering in DB.
    const textRegex = new RegExp(destinationQuery, 'i');
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
        .limit(20)
        .lean();
    } catch (dbErr) {
      console.warn('Tier 1 TouristPlace regex search failed:', dbErr.message);
      touristPlaceMatches = [];
    }

    // Tier 2: If Tier 1 yields < 3 results, run the semantic $vectorSearch cascade
    if (touristPlaceMatches.length < 3) {
      try {
        const descriptivePhrase = `${destinationQuery}, top tourist places, attractions and sightseeing highlights`;
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
        return {
          ...rest,
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
          isCurated: true,
          source: rest.score != null ? 'tourist_places_vector' : 'tourist_places',
        };
      });
    } else {
      // Tier 3: If still 0 results, query Nominatim exactly as before, setting category: null for all returned items.
      const fallbackNotice = "No curated activities found for this destination — here's what we found nearby";
      let rawPlaces = [];
      try {
        rawPlaces = await searchPlaces(destinationQuery, { countrycodes: 'in' });
      } catch (geoErr) {
        console.warn('Nominatim geocoding failed:', geoErr.message);
        rawPlaces = [];
      }

      // Check Overpass fallback for coordinates if available
      if (rawPlaces.length > 0 && rawPlaces[0].latitude != null && rawPlaces[0].longitude != null) {
        const { latitude, longitude } = rawPlaces[0];
        try {
          const overpassPlaces = await findTaggedPlaces(latitude, longitude, 'all', destinationQuery);
          if (Array.isArray(overpassPlaces) && overpassPlaces.length > 0) {
            processedResults = overpassPlaces.map((op) => ({
              name: op.name,
              address: `${op.name}, ${destinationQuery}${op.category ? ` • ${op.category}` : ''}`,
              latitude: op.lat,
              longitude: op.lon,
              type: op.category || op.rawType || 'Attraction',
              category: op.category || null,
              source: 'overpass',
              isCurated: false,
              notice: fallbackNotice,
              fallbackNotice: fallbackNotice,
            }));
          }
        } catch (overpassErr) {
          console.warn('Overpass query failed or timed out, falling back to raw Nominatim:', overpassErr.message);
        }
      }

      // Raw Nominatim fallback if Overpass yielded 0 places
      if (processedResults.length === 0 && rawPlaces.length > 0) {
        processedResults = rawPlaces.map((place) => ({
          name: place.name,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
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

    // Response: Return { results: processedResults, availableCategories: Array.from(foundCategories) }
    const payload = {
      results: processedResults,
      destinations: processedResults, // alias for backwards compatibility
      availableCategories: Array.from(foundCategories),
    };

    destinationResponseCache.set(cacheKey, {
      data: payload,
      expiresAt: Date.now() + DEST_CACHE_TTL_MS,
    });

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

export default router;