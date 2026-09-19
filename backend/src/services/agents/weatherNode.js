import { searchPlaces } from '../placesService.js';
import { getWeatherForecast, FALLBACK_WEATHER } from '../weatherService.js';

/**
 * Weather tool node for LangGraph.
 * Resolves destination coordinates via searchPlaces, then fetches forecast for startDate.
 * Writes result to state.weather.
 * @param {Object} state - Graph state
 * @returns {Promise<{weather: Object}>}
 */
export const weatherNode = async (state) => {
  const { destination, startDate } = state || {};

  if (!destination) {
    return { weather: FALLBACK_WEATHER };
  }

  try {
    const places = await searchPlaces(destination);
    if (!places || places.length === 0 || places[0].latitude == null || places[0].longitude == null) {
      return { weather: FALLBACK_WEATHER };
    }

    const topResult = places[0];
    const weather = await getWeatherForecast(
      topResult.latitude,
      topResult.longitude,
      startDate || new Date().toISOString().slice(0, 10)
    );
    return { weather };
  } catch (error) {
    console.warn('weatherNode error, using fallback:', error.message);
    return { weather: FALLBACK_WEATHER };
  }
};

export default weatherNode;
