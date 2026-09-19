// Placeholder constants for fixed per-day rate in INR by budget tier
export const DAILY_RATES_INR = {
  budget: 1500,
  mid: 4000,
  luxury: 10000,
};

/**
 * Calculates number of days between two dates.
 * @param {string|Date} startDate 
 * @param {string|Date} endDate 
 * @returns {number} Number of days (minimum 1)
 */
export const calculateTripDays = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 1;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 1;
  }
  const diffMs = Math.abs(end.getTime() - start.getTime());
  const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 1;
};

/**
 * Budget tool node for LangGraph.
 * Estimates total cost using fixed per-day rates in INR multiplied by number of days.
 * Writes to state.budgetEstimate.
 * @param {Object} state - Graph state
 * @returns {Promise<{budgetEstimate: number}>}
 */
export const budgetNode = async (state) => {
  const { startDate, endDate, budgetTier } = state || {};

  const tier = (budgetTier || 'mid').trim().toLowerCase();
  const dailyRate = DAILY_RATES_INR[tier] ?? DAILY_RATES_INR.mid;
  const days = calculateTripDays(startDate, endDate);
  const budgetEstimate = days * dailyRate;

  return {
    budgetEstimate,
  };
};

export default budgetNode;

