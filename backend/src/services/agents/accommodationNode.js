import CuratedHotel from '../../models/CuratedHotel.js';

/**
 * Accommodation tool node for LangGraph.
 * Queries CuratedHotel for destination matching state.destination and budgetTier matching state.budgetTier.
 * Writes results to state.accommodationOptions.
 * @param {Object} state - Graph state
 * @returns {Promise<{accommodationOptions: Array}>}
 */
export const accommodationNode = async (state) => {
  try {
    const destination = (state?.destination || '').trim();
    const budgetTier = (state?.budgetTier || '').trim().toLowerCase();

    const query = {};
    if (destination) {
      query.destination = new RegExp(`^${destination}$`, 'i');
    }
    if (budgetTier) {
      query.budgetTier = budgetTier;
    }

    const hotels = await CuratedHotel.find(query).lean();

    return {
      accommodationOptions: Array.isArray(hotels) ? hotels : [],
    };
  } catch (error) {
    console.error('accommodationNode error:', error.message);
    return {
      accommodationOptions: [],
    };
  }
};

export default accommodationNode;

