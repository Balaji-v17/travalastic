
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
import { retrieveCandidates } from '../candidateRetrieval.js';

export const attractionsNode = async (state) => {
  const { destination } = state || {};

  if (!destination || typeof destination !== 'string' || !destination.trim()) {
    return { attractions: [] };
  }

  try {
    const candidates = await retrieveCandidates(destination.trim());
    return {
      attractions: candidates.map((c) => ({
        ...c,
        placeId: c.id,
        category: c.type,
      })),
    };
  } catch (error) {
    console.warn('attractionsNode error, returning empty list:', error.message);
    return { attractions: [] };
  }
};

export default attractionsNode;

