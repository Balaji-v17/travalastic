import 'dotenv/config';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';

/**
 * Minimum precipitation probability to consider rain likely.
 */
export const RAIN_LIKELY_THRESHOLD = 0.5;

// In-memory 10-minute cache for 3-hour forecasts
const forecastCache = new Map();
const FORECAST_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Fetches OpenWeather 5-day / 3-hour forecast for coordinates.
 * Extracts `pop` (probability of precipitation) from list items and `city.timezone`.
 *
 * @param {number|string} lat
 * @param {number|string} lon
 * @returns {Promise<{ list: Array<object>, city: object, timezoneOffsetSeconds: number }>}
 */
export async function fetch3HourForecast(lat, lon) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENWEATHER_API_KEY is not defined in environment variables');
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (isNaN(latNum) || isNaN(lonNum)) {
    throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
  }

  const cacheKey = `${latNum.toFixed(3)}_${lonNum.toFixed(3)}`;
  const cached = forecastCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latNum}&lon=${lonNum}&appid=${apiKey}&units=metric`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`OpenWeather API error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  const result = {
    list: Array.isArray(data.list) ? data.list : [],
    city: data.city || {},
    timezoneOffsetSeconds: typeof data.city?.timezone === 'number' ? data.city.timezone : 0,
  };

  forecastCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + FORECAST_CACHE_TTL_MS,
  });

  return result;
}

/**
 * Computes destination-local rain buckets for a day:
 * - Morning: 06:00 - 11:59
 * - Afternoon: 12:00 - 16:59
 * - Evening: 17:00 - 20:59
 * - Night: 21:00 - 23:59
 *
 * Drops buckets that have already ended in destination-local time.
 * Returns buckets whose maximum probability is at or above RAIN_LIKELY_THRESHOLD (0.5).
 *
 * @param {Array<object>} forecastItems - OpenWeather 3-hour entries with `dt` (unix sec) and `pop` (0 to 1)
 * @param {number} cityTimezoneOffsetSeconds - Shift in seconds from UTC (city.timezone)
 * @param {Date|number|string} nowUtc - Current UTC time reference
 * @param {string} [targetDateStr] - Target date string (YYYY-MM-DD); defaults to destination's local date at nowUtc
 * @returns {Array<{ bucket: string, probabilityPercent: number, maxPop: number }>}
 */
export function computeRainBuckets(
  forecastItems = [],
  cityTimezoneOffsetSeconds = 0,
  nowUtc = new Date(),
  targetDateStr = null
) {
  if (!Array.isArray(forecastItems) || forecastItems.length === 0) {
    return [];
  }

  const nowUtcMs =
    nowUtc instanceof Date
      ? nowUtc.getTime()
      : typeof nowUtc === 'number'
      ? (nowUtc < 1e11 ? nowUtc * 1000 : nowUtc)
      : typeof nowUtc === 'string'
      ? new Date(nowUtc).getTime()
      : Date.now();

  const destinationLocalNowMs = nowUtcMs + cityTimezoneOffsetSeconds * 1000;
  const localNowDate = new Date(destinationLocalNowMs);
  const targetDate = targetDateStr || localNowDate.toISOString().slice(0, 10);

  const [tYear, tMonth, tDay] = targetDate.split('-').map(Number);
  if (!tYear || !tMonth || !tDay) {
    return [];
  }

  // Local bucket end boundaries in shifted UTC ms
  const bucketEndTimes = {
    Morning: Date.UTC(tYear, tMonth - 1, tDay, 12, 0, 0),
    Afternoon: Date.UTC(tYear, tMonth - 1, tDay, 17, 0, 0),
    Evening: Date.UTC(tYear, tMonth - 1, tDay, 21, 0, 0),
    Night: Date.UTC(tYear, tMonth - 1, tDay + 1, 0, 0, 0),
  };

  const bucketPops = {
    Morning: [],
    Afternoon: [],
    Evening: [],
    Night: [],
  };

  for (const item of forecastItems) {
    if (!item || typeof item.dt !== 'number') continue;

    const itemLocalMs = (item.dt + cityTimezoneOffsetSeconds) * 1000;
    const itemLocalDate = new Date(itemLocalMs);
    const itemDateStr = itemLocalDate.toISOString().slice(0, 10);

    if (itemDateStr !== targetDate) {
      continue;
    }

    const hours = itemLocalDate.getUTCHours();
    const minutes = itemLocalDate.getUTCMinutes();
    const timeInMinutes = hours * 60 + minutes;

    let bucketName = null;
    if (timeInMinutes >= 360 && timeInMinutes <= 719) {
      bucketName = 'Morning'; // 06:00 - 11:59
    } else if (timeInMinutes >= 720 && timeInMinutes <= 1019) {
      bucketName = 'Afternoon'; // 12:00 - 16:59
    } else if (timeInMinutes >= 1020 && timeInMinutes <= 1259) {
      bucketName = 'Evening'; // 17:00 - 20:59
    } else if (timeInMinutes >= 1260 && timeInMinutes <= 1439) {
      bucketName = 'Night'; // 21:00 - 23:59
    }

    if (bucketName) {
      const pop = typeof item.pop === 'number' ? item.pop : 0;
      bucketPops[bucketName].push(pop);
    }
  }

  const result = [];
  const bucketOrder = ['Morning', 'Afternoon', 'Evening', 'Night'];

  for (const bucketName of bucketOrder) {
    // Drop buckets that have already ended in destination-local time
    if (destinationLocalNowMs >= bucketEndTimes[bucketName]) {
      continue;
    }

    const pops = bucketPops[bucketName];
    if (pops.length === 0) {
      continue;
    }

    const maxPop = Math.max(...pops);
    if (maxPop >= RAIN_LIKELY_THRESHOLD) {
      result.push({
        bucket: bucketName,
        probabilityPercent: Math.round(maxPop * 100),
        maxPop,
      });
    }
  }

  return result;
}

/**
 * Checks whether an activity's suggestedTime matches a given rain bucket.
 *
 * @param {string|null|undefined} suggestedTime e.g. "Morning", "Afternoon", "10:00 AM", "2:30 PM"
 * @param {string} bucketName "Morning", "Afternoon", "Evening", "Night"
 * @returns {boolean}
 */
export function matchesSuggestedTimeBucket(suggestedTime, bucketName) {
  if (!suggestedTime || typeof suggestedTime !== 'string') {
    return false;
  }

  const lower = suggestedTime.trim().toLowerCase();
  const target = bucketName.toLowerCase();

  // Direct word containment (e.g. "morning", "early afternoon", "evening walk")
  if (lower.includes(target)) {
    return true;
  }

  // Parse time patterns (e.g. "10:00 AM", "2:30 PM", "14:00")
  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const match = lower.match(timeRegex);
  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toLowerCase() : null;

    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;

    const totalMinutes = hour * 60 + minute;
    if (target === 'morning' && totalMinutes >= 360 && totalMinutes <= 719) return true;
    if (target === 'afternoon' && totalMinutes >= 720 && totalMinutes <= 1019) return true;
    if (target === 'evening' && totalMinutes >= 1020 && totalMinutes <= 1259) return true;
    if (target === 'night' && totalMinutes >= 1260 && totalMinutes <= 1439) return true;
  }

  return false;
}

/**
 * Classifies a list of activities as outdoor (true), indoor (false), or unclear (null)
 * using one structured-output LLM call via ChatGroq.
 *
 * @param {Array<{ title?: string, name?: string, description?: string }>} activities
 * @returns {Promise<Array<boolean|null>>} Array of true (outdoor), false (indoor), or null (unclear)
 */
export async function classifyActivitiesOutdoor(activities = []) {
  if (!Array.isArray(activities) || activities.length === 0) {
    return [];
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return activities.map(() => null);
  }

  const ClassificationItemSchema = z.object({
    index: z.number().describe('0-based index of the activity in the provided list'),
    classification: z
      .enum(['outdoor', 'indoor', 'unclear'])
      .describe('"outdoor" if primarily outdoors/open-air, "indoor" if inside/covered, "unclear" if mixed or ambiguous'),
  });

  const OutputSchema = z.object({
    classifications: z.array(ClassificationItemSchema),
  });

  const activityListText = activities
    .map(
      (a, i) =>
        `${i}. Title: ${a.title || a.name || 'Untitled'} | Description: ${a.description || 'No description'}`
    )
    .join('\n');

  const systemPrompt = `You are a travel activity classifier. For each numbered activity, determine whether it is:
- "outdoor" (e.g. beach visits, outdoor walking tours, hiking, viewpoints, boat trips, parks, outdoor bazaars)
- "indoor" (e.g. museums, covered galleries, indoor shopping malls, indoor restaurants, covered monuments, temples/churches with exclusively indoor shrines)
- "unclear" (if mixed, uncertain, or ambiguous)

Output strictly according to the schema.`;

  const primaryModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  let result = null;

  try {
    const chat = new ChatGroq({
      apiKey,
      model: primaryModel,
      temperature: 0.1,
    }).withStructuredOutput(OutputSchema);

    result = await chat.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: activityListText },
    ]);
  } catch (err) {
    console.warn('ChatGroq primary model failed for outdoor classification:', err.message);
    try {
      const secondaryChat = new ChatGroq({
        apiKey,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.1,
      }).withStructuredOutput(OutputSchema);

      result = await secondaryChat.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: activityListText },
      ]);
    } catch (secErr) {
      console.warn('ChatGroq secondary model also failed:', secErr.message);
    }
  }

  const map = new Map();
  if (result?.classifications && Array.isArray(result.classifications)) {
    for (const item of result.classifications) {
      if (typeof item.index === 'number') {
        if (item.classification === 'outdoor') map.set(item.index, true);
        else if (item.classification === 'indoor') map.set(item.index, false);
        else map.set(item.index, null);
      }
    }
  }

  return activities.map((_, i) => (map.has(i) ? map.get(i) : null));
}

