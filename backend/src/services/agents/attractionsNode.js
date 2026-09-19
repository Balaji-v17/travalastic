import { searchPlaces } from '../placesService.js';

/**
 * Attractions tool node for LangGraph.
 * Searches for places matching state.destination and writes the trimmed list to state.attractions.
 * @param {Object} state - Graph state
 * @returns {Promise<{attractions: Array}>}
 */
export const attractionsNode = async (state) => {
  const { destination } = state || {};

  if (!destination) {
    return { attractions: [] };
  }

  try {
    const places = await searchPlaces(destination);
    return {
      attractions: Array.isArray(places) ? places : [],
    };
  } catch (error) {
    console.warn('attractionsNode error, returning empty list:', error.message);
    return { attractions: [] };
  }
};

export default attractionsNode;

