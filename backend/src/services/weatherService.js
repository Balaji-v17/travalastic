// OpenWeather forecast utility
const parseDateString = (inputDate) => {
  if (!inputDate) return null;
  if (typeof inputDate === 'string') {
    const match = inputDate.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
  }
  const d = new Date(inputDate);
  if (isNaN(d.getTime())) {
    return null;
  }
  return d.toISOString().slice(0, 10);
};

const FALLBACK_WEATHER = {
  description: 'Forecast unavailable for dates more than 5 days in advance. Expect typical seasonal weather.',
  temperature: 'N/A',
};

// In-memory cache for weather forecasts (TTL: 10 minutes)
const weatherCache = new Map();
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Checks if target date string (YYYY-MM-DD) is more than 5 days in the future from current UTC date.
 * @param {string} dateStr
 * @returns {boolean}
 */
const isMoreThan5DaysOut = (dateStr) => {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const diffDays = (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > 5;
};

/**
 * Fetches 5-day forecast from OpenWeather and returns trimmed weather summary for a specific date.
 * If date is > 5 days in advance, returns a fallback object without calling OpenWeather.
 * @param {number|string} latitude 
 * @param {number|string} longitude 
 * @param {string|Date} date - Date string (YYYY-MM-DD) or Date object
 * @returns {Promise<{condition?: string, temp_min?: number, temp_max?: number, description: string, temperature: string}>}
 */
const getWeatherForecast = async (latitude, longitude, date) => {
  if (latitude == null || longitude == null || !date) {
    throw new Error('Latitude, longitude, and date are required parameters');
  }

  const targetDateStr = parseDateString(date);
  if (!targetDateStr) {
    throw new Error(`Invalid date format provided: "${date}". Expected format: YYYY-MM-DD.`);
  }

  // Check if startDate is more than 5 days in the future from the current date
  if (isMoreThan5DaysOut(targetDateStr)) {
    return { ...FALLBACK_WEATHER };
  }

  const latNum = parseFloat(latitude);
  const lonNum = parseFloat(longitude);
  if (isNaN(latNum) || isNaN(lonNum)) {
    throw new Error(`Invalid coordinates: latitude="${latitude}", longitude="${longitude}"`);
  }

  // Check cache for identical coordinates and date
  const cacheKey = `${latNum.toFixed(3)}_${lonNum.toFixed(3)}_${targetDateStr}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY is not defined in environment variables');
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latNum}&lon=${lonNum}&appid=${apiKey}&units=metric`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      // Catch 400-level errors regarding dates or invalid ranges and return fallback object
      if (response.status >= 400 && response.status < 500) {
        return { ...FALLBACK_WEATHER };
      }
      const errorBody = await response.text().catch(() => '');
      throw new Error(`OpenWeather API error (${response.status}): ${errorBody || response.statusText}`);
    }

    const data = await response.json();
    const list = Array.isArray(data.list) ? data.list : [];

    if (list.length === 0) {
      return { ...FALLBACK_WEATHER };
    }

    // Filter forecasts for the requested date
    const matching = list.filter((item) => {
      if (item.dt_txt && item.dt_txt.startsWith(targetDateStr)) {
        return true;
      }
      if (item.dt) {
        const entryDate = new Date(item.dt * 1000).toISOString().slice(0, 10);
        return entryDate === targetDateStr;
      }
      return false;
    });

    if (matching.length === 0) {
      return { ...FALLBACK_WEATHER };
    }

    // Calculate temp_min, temp_max, and dominant condition
    let minTemp = Infinity;
    let maxTemp = -Infinity;
    const conditionCounts = {};

    for (const item of matching) {
      if (item.main) {
        if (typeof item.main.temp_min === 'number' && item.main.temp_min < minTemp) {
          minTemp = item.main.temp_min;
        }
        if (typeof item.main.temp_max === 'number' && item.main.temp_max > maxTemp) {
          maxTemp = item.main.temp_max;
        }
      }

      if (Array.isArray(item.weather) && item.weather[0] && item.weather[0].main) {
        const cond = item.weather[0].main.toLowerCase();
        conditionCounts[cond] = (conditionCounts[cond] || 0) + 1;
      }
    }

    // Fallback to item.main.temp if min/max weren't populated
    if (!isFinite(minTemp) || !isFinite(maxTemp)) {
      const temps = matching.map((i) => i.main?.temp).filter((t) => typeof t === 'number');
      if (temps.length > 0) {
        minTemp = Math.min(...temps);
        maxTemp = Math.max(...temps);
      } else {
        minTemp = 0;
        maxTemp = 0;
      }
    }

    // Pick dominant condition
    let dominantCondition = 'unknown';
    let maxCount = 0;
    for (const [cond, count] of Object.entries(conditionCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantCondition = cond;
      }
    }

    const roundedMin = Math.round(minTemp * 100) / 100;
    const roundedMax = Math.round(maxTemp * 100) / 100;
    const avgTemp = Math.round(((minTemp + maxTemp) / 2) * 100) / 100;

    const result = {
      condition: dominantCondition,
      temp_min: roundedMin,
      temp_max: roundedMax,
      description: dominantCondition,
      temperature: `${avgTemp}°C`,
    };

    weatherCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + WEATHER_CACHE_TTL_MS,
    });

    return result;
  } catch (error) {
    // If error is a 400-level error or date issue, return fallback instead of throwing
    if (
      error.message &&
      (error.message.includes('400') ||
        error.message.includes('too far in the future') ||
        error.message.includes('past') ||
        error.message.includes('date'))
    ) {
      return { ...FALLBACK_WEATHER };
    }
    throw error;
  }
};

export default getWeatherForecast;
export { getWeatherForecast, FALLBACK_WEATHER };
