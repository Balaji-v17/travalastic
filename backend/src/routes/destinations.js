import express from 'express';
import { searchPlaces } from '../services/placesService.js';
import { getPhotoForDestination } from '../services/pexelsService.js';

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

// In-memory 24-hour cache for trending destinations
let trendingCache = null;
let trendingCacheExpiresAt = 0;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const getTrendingDestinations = async (req, res) => {
  try {
    const now = Date.now();
    if (trendingCache && now < trendingCacheExpiresAt) {
      return res.status(200).json(trendingCache);
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

    return res.status(200).json(results);
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
  const { q } = req.query;

  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const cacheKey = q.trim().toLowerCase();
  const cached = destinationResponseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return res.status(200).json(cached.data);
  }

  try {
    const destinations = await searchPlaces(q);

    destinationResponseCache.set(cacheKey, {
      data: destinations,
      expiresAt: Date.now() + DEST_CACHE_TTL_MS,
    });

    return res.status(200).json(destinations);
  } catch (error) {
    console.error('Error in searchDestinations:', error.message);
    return res.status(502).json({
      error: error.message || 'Failed to fetch destinations from OpenStreetMap Nominatim API',
    });
  }
};

router.get('/trending', getTrendingDestinations);
router.get('/search', searchDestinations);

export default router;