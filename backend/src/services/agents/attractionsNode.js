import { fetchExplorePlaces } from '../../routes/destinations.js';

/**
 * Maps raw user interest strings to normalized destination categories.
 *
 * @param {string} interest
 * @returns {string|null}
 */
export const mapInterestToCategory = (interest = '') => {
  if (!interest || typeof interest !== 'string') return null;
  const lower = interest.toLowerCase().trim();
  if (lower.includes('beach')) return 'Beaches';
  if (
    lower.includes('temple') ||
    lower.includes('spiritual') ||
    lower.includes('church') ||
    lower.includes('religious') ||
    lower.includes('mosque') ||
    lower.includes('monastery') ||
    lower.includes('shrine')
  ) {
    return 'Temples';
  }
  if (lower.includes('museum') || lower.includes('art') || lower.includes('exhibit')) return 'Museums';
  if (
    lower.includes('nightlife') ||
    lower.includes('night') ||
    lower.includes('club') ||
    lower.includes('bar') ||
    lower.includes('pub') ||
    lower.includes('cocktail')
  ) {
    return 'Nightlife';
  }
  if (
    lower.includes('hill station') ||
    lower.includes('hill') ||
    lower.includes('mountain') ||
    lower.includes('viewpoint') ||
    lower.includes('peak')
  ) {
    return 'Hill Stations';
  }
  if (lower.includes('waterfall') || lower.includes('falls')) return 'Waterfalls';
  if (
    lower.includes('wildlife') ||
    lower.includes('sanctuary') ||
    lower.includes('national park') ||
    lower.includes('safari') ||
    lower.includes('nature reserve')
  ) {
    return 'Wildlife Sanctuary';
  }
  if (
    lower.includes('fort') ||
    lower.includes('castle') ||
    lower.includes('palace') ||
    lower.includes('heritage') ||
    lower.includes('historical') ||
    lower.includes('monument')
  ) {
    return 'Forts';
  }
  return null;
};

/**
 * Attractions node for LangGraph.
 * Uses the Explore cascade (TouristPlace fuzzy match -> semantic search -> Nominatim geocode + Overpass tagged-places)
 * and reuses Explore's per-destination cache.
 * Returns up to ~30 places balanced across categories matching state.interests.
 *
 * @param {Object} state - Graph state
 * @returns {Promise<{attractions: Array<{placeId: string, name: string, category: string|null, lat: number|null, lon: number|null}>}>}
 */
export const attractionsNode = async (state) => {
  const { destination, interests } = state || {};

  if (!destination || typeof destination !== 'string' || !destination.trim()) {
    return { attractions: [] };
  }

  try {
    // Reuses Explore's cascade and per-destination cache (destinationResponseCache)
    const payload = await fetchExplorePlaces(destination.trim());
    const allPlaces = Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.destinations)
      ? payload.destinations
      : Array.isArray(payload)
      ? payload
      : [];

    if (allPlaces.length === 0) {
      return { attractions: [] };
    }

    // Normalize to { placeId, name, category, lat, lon }
    const normalized = allPlaces
      .filter((p) => p && (p.placeId || p._id) && p.name)
      .map((p) => {
        const placeId = p.placeId || (p._id ? p._id.toString() : null);
        const lat = p.lat != null ? Number(p.lat) : p.latitude != null ? Number(p.latitude) : null;
        const lon = p.lon != null ? Number(p.lon) : p.longitude != null ? Number(p.longitude) : null;
        return {
          placeId,
          name: p.name.trim(),
          category: p.category || null,
          lat: isNaN(lat) ? null : lat,
          lon: isNaN(lon) ? null : lon,
        };
      });

    // Identify categories matching state.interests
    const rawInterests = Array.isArray(interests)
      ? interests
      : typeof interests === 'string'
      ? [interests]
      : [];

    const matchingCategories = new Set();
    for (const interest of rawInterests) {
      const cat = mapInterestToCategory(interest);
      if (cat) matchingCategories.add(cat);
    }

    // Partition candidate places into matching category buckets and non-matching places
    const categoryBuckets = new Map();
    for (const cat of matchingCategories) {
      categoryBuckets.set(cat, []);
    }
    const nonMatchingPlaces = [];

    for (const place of normalized) {
      if (place.category && categoryBuckets.has(place.category)) {
        categoryBuckets.get(place.category).push(place);
      } else {
        nonMatchingPlaces.push(place);
      }
    }

    const selectedPlaces = [];
    const seenPlaceIds = new Set();
    const TARGET_LIMIT = 30;

    // Round-robin selection across matching categories to balance distribution
    if (matchingCategories.size > 0) {
      let addedInRound = true;
      while (selectedPlaces.length < TARGET_LIMIT && addedInRound) {
        addedInRound = false;
        for (const [cat, bucket] of categoryBuckets.entries()) {
          if (selectedPlaces.length >= TARGET_LIMIT) break;
          if (bucket.length > 0) {
            const place = bucket.shift();
            if (!seenPlaceIds.has(place.placeId)) {
              selectedPlaces.push(place);
              seenPlaceIds.add(place.placeId);
              addedInRound = true;
            }
          }
        }
      }
    }

    // Fill remaining slots up to TARGET_LIMIT from non-matching places
    for (const place of nonMatchingPlaces) {
      if (selectedPlaces.length >= TARGET_LIMIT) break;
      if (!seenPlaceIds.has(place.placeId)) {
        selectedPlaces.push(place);
        seenPlaceIds.add(place.placeId);
      }
    }

    // Also pick any remaining places from matching buckets if still under limit
    for (const [, bucket] of categoryBuckets.entries()) {
      for (const place of bucket) {
        if (selectedPlaces.length >= TARGET_LIMIT) break;
        if (!seenPlaceIds.has(place.placeId)) {
          selectedPlaces.push(place);
          seenPlaceIds.add(place.placeId);
        }
      }
    }

    return {
      attractions: selectedPlaces,
    };
  } catch (error) {
    console.warn('attractionsNode error, returning empty list:', error.message);
    return { attractions: [] };
  }
};

export default attractionsNode;

