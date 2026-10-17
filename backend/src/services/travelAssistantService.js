import { ChatGroq } from '@langchain/groq';
import { tool } from '@langchain/core/tools';
import { ToolMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { searchPlaces } from './placesService.js';
import { getWeatherForecast } from './weatherService.js';
import { getAssistantSystemPrompt } from '../prompts/travelAssistant.js';

export const MAX_REPLY_LENGTH = 2000;
export const MAX_TOOL_CALLS = 2;
export const TOOL_TIMEOUT_MS = 5000;
export const FORECAST_WINDOW_DAYS = 5;

/**
 * Pure function to validate and sanitize an assistant request body.
 *
 * Rules:
 * - message: trimmed string, 1 to 1000 characters (400 otherwise).
 * - history: array of { role, content } with role "user" or "assistant" only (400 for any other role).
 *   Truncate each content to 2000 characters. If more than 10 entries, keep only newest 10.
 * - tripId: optional string.
 *
 * @param {Object} body - Request body
 * @returns {{ isValid: boolean, error: string|null, message?: string, history?: Array<{role: string, content: string}>, tripId?: string }}
 */
export function validateAssistantRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      error: 'Request body must be a valid JSON object',
    };
  }

  if (typeof body.message !== 'string') {
    return {
      isValid: false,
      error: 'message string is required in request body',
    };
  }

  const trimmedMessage = body.message.trim();
  if (trimmedMessage.length < 1 || trimmedMessage.length > 1000) {
    return {
      isValid: false,
      error: 'message must be between 1 and 1000 characters',
    };
  }

  let cleanHistory = [];
  if (body.history !== undefined && body.history !== null) {
    if (!Array.isArray(body.history)) {
      return {
        isValid: false,
        error: 'history must be an array of { role, content }',
      };
    }

    for (let i = 0; i < body.history.length; i++) {
      const entry = body.history[i];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return {
          isValid: false,
          error: `history entry at index ${i} must be an object`,
        };
      }

      if (entry.role !== 'user' && entry.role !== 'assistant') {
        return {
          isValid: false,
          error: `Invalid role "${entry.role}" at history index ${i}. Only "user" and "assistant" roles are allowed.`,
        };
      }

      const rawContent =
        typeof entry.content === 'string'
          ? entry.content
          : entry.content != null
          ? String(entry.content)
          : '';

      cleanHistory.push({
        role: entry.role,
        content: rawContent.slice(0, 2000),
      });
    }

    if (cleanHistory.length > 10) {
      cleanHistory = cleanHistory.slice(-10);
    }
  }

  const tripId =
    body.tripId && typeof body.tripId === 'string' && body.tripId.trim()
      ? body.tripId.trim()
      : undefined;

  return {
    isValid: true,
    error: null,
    message: trimmedMessage,
    history: cleanHistory,
    tripId,
  };
}

/**
 * Pure function to extract whitelisted trip context for the Travel Assistant.
 *
 * Rules:
 * - ONLY whitelisted fields: destination, start and end dates, budget tier, and interests.
 * - NEVER copies activities, expenses, flights, packing, notes, or raw requests.
 * - Presents them as helpful context, not as a restriction.
 *
 * @param {Object} [itinerary] - Itinerary document or plain object
 * @param {Object} [options={}] - Options (e.g. asObject: true)
 * @returns {string|Object} Formatted context string or object with whitelisted fields
 */
export function buildTripHint(itinerary, options = {}) {
  if (!itinerary) {
    return options.asObject ? null : '';
  }

  const itin =
    typeof itinerary.toObject === 'function' ? itinerary.toObject() : itinerary;

  const destination = itin.destination ? String(itin.destination).trim() : null;
  const startDate = itin.startDate ? String(itin.startDate).trim() : null;
  const endDate = itin.endDate ? String(itin.endDate).trim() : null;
  const budgetTier = itin.budgetTier ? String(itin.budgetTier).trim() : null;
  const interests = Array.isArray(itin.interests)
    ? itin.interests
        .map((i) => (i != null ? String(i).trim() : ''))
        .filter(Boolean)
    : [];

  if (options.asObject) {
    return {
      destination,
      startDate,
      endDate,
      budgetTier,
      interests,
    };
  }

  const lines = [
    'HELPFUL TRIP CONTEXT (Provided as background context only, not as a restriction):',
  ];

  if (destination) {
    lines.push(`Destination: ${destination}`);
  }

  if (startDate && endDate) {
    lines.push(`Dates: ${startDate} to ${endDate}`);
  } else if (startDate) {
    lines.push(`Start Date: ${startDate}`);
  } else if (endDate) {
    lines.push(`End Date: ${endDate}`);
  }

  if (budgetTier) {
    lines.push(`Budget Tier: ${budgetTier}`);
  }

  if (interests.length > 0) {
    lines.push(`Interests: ${interests.join(', ')}`);
  }

  // If no fields matched, return empty string
  if (lines.length === 1) {
    return '';
  }

  return lines.join('\n');
}

/**
 * Pure function to verify if a date is within the supported OpenWeather forecast window.
 * OpenWeather 5-day forecast covers [today, today + 5 days].
 *
 * @param {string|Date} date - Target date (e.g. YYYY-MM-DD or Date object)
 * @param {string|Date} [now=new Date()] - Reference "current" date
 * @param {number} [maxDays=5] - Maximum days in advance
 * @returns {boolean} True if within window, false if past or beyond window
 */
export function isDateWithinForecastWindow(date, now = new Date(), maxDays = FORECAST_WINDOW_DAYS) {
  if (!date) return false;

  let targetDateStr = null;
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      targetDateStr = match[1];
    } else {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) return false;
      targetDateStr = parsed.toISOString().slice(0, 10);
    }
  } else if (date instanceof Date && !isNaN(date.getTime())) {
    targetDateStr = date.toISOString().slice(0, 10);
  } else {
    return false;
  }

  const nowDate = now instanceof Date ? now : new Date(now);
  if (isNaN(nowDate.getTime())) return false;

  const todayUtc = new Date(
    Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())
  );
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetUtc = new Date(Date.UTC(y, m - 1, d));

  const diffDays = Math.round(
    (targetUtc.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24)
  );

  return diffDays >= 0 && diffDays <= maxDays;
}

/**
 * Shared retry wrapper that retries on rate limits (429) or transient server errors with backoff.
 *
 * @param {Function} fn - Async operation to execute
 * @param {number} [maxRetries=2] - Maximum retry attempts
 * @param {number} [delayMs=1000] - Base delay in milliseconds
 * @returns {Promise<any>}
 */
export async function invokeWithRetry(fn, maxRetries = 2, delayMs = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRateLimit =
        err?.status === 429 || (err?.message && err.message.includes('429'));
      const isTransient =
        err?.status >= 500 ||
        (err?.message && /timeout|unavailable|econnreset|fetch failed/i.test(err.message));

      if ((isRateLimit || isTransient) && attempt < maxRetries) {
        const wait = delayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Executes a single weather forecast lookup using geocoding and weatherService.
 * Enforces a 5-second timeout and catches all errors to return plain text to the LLM.
 *
 * @param {Object} params
 * @param {string} params.place - Destination or city name
 * @param {string} params.date - Date in YYYY-MM-DD format
 * @param {Array} [params.sources=[]] - Array to append source attribution
 * @param {Date} [params.now=new Date()] - Reference date
 * @param {Function} [params.searchPlacesFn=searchPlaces] - Geocoding function
 * @param {Function} [params.weatherServiceFn=getWeatherForecast] - Weather forecast function
 * @returns {Promise<string>} Plain text forecast or plain text error description
 */
export async function runForecastLookup({
  place,
  date,
  sources = [],
  now = new Date(),
  searchPlacesFn = searchPlaces,
  weatherServiceFn = getWeatherForecast,
}) {
  if (!place || typeof place !== 'string' || !place.trim()) {
    return 'A valid destination or place name is required for weather forecast.';
  }
  if (!date || typeof date !== 'string' || !date.trim()) {
    return 'A valid date (YYYY-MM-DD) is required for weather forecast.';
  }

  const trimmedPlace = place.trim();
  const trimmedDate = date.trim();

  // Validate forecast date window
  if (!isDateWithinForecastWindow(trimmedDate, now)) {
    return 'forecasts available only for the next 5 days';
  }

  // 5-second timeout controller
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Weather lookup timed out after 5 seconds'));
    }, TOOL_TIMEOUT_MS);
    if (timer.unref) timer.unref();
  });

  const lookupPromise = (async () => {
    // 1. Geocode place to lat/lng
    let places = await searchPlacesFn(trimmedPlace, { countrycodes: '' });
    if (!places || places.length === 0 || places[0].latitude == null || places[0].longitude == null) {
      places = await searchPlacesFn(trimmedPlace);
    }

    if (
      !places ||
      places.length === 0 ||
      places[0].latitude == null ||
      places[0].longitude == null
    ) {
      return `Could not find location coordinates for "${trimmedPlace}".`;
    }

    const topPlace = places[0];
    const targetDateStr = trimmedDate.slice(0, 10);

    // 2. Fetch forecast
    const forecast = await weatherServiceFn(
      topPlace.latitude,
      topPlace.longitude,
      targetDateStr
    );

    // 3. Record source attribution
    sources.push({
      type: 'forecast',
      provider: 'OpenWeather',
      date: targetDateStr,
      place: topPlace.name || trimmedPlace,
    });

    const cond = forecast.condition || forecast.description || 'Clear';
    const temp = forecast.temperature || `${forecast.temp_min} - ${forecast.temp_max}°C`;

    return `Weather forecast for ${topPlace.name || trimmedPlace} on ${targetDateStr}: Condition: ${cond}, Temperature: ${temp}`;
  })();

  try {
    return await Promise.race([lookupPromise, timeoutPromise]);
  } catch (error) {
    return `Weather forecast error: ${error.message}`;
  }
}

/**
 * Creates the LangChain read-only getForecast tool.
 *
 * @param {Array} sources - Accumulator array for sources
 * @param {Object} [deps={}] - Dependency injection for testing
 * @returns {Object} LangChain tool instance
 */
export function createForecastTool(sources, deps = {}) {
  let callCount = 0;
  return tool(
    async ({ place, date }) => {
      if (callCount >= MAX_TOOL_CALLS) {
        return 'Maximum limit of 2 weather lookups reached for this request.';
      }
      callCount++;
      return runForecastLookup({
        place,
        date,
        sources,
        now: deps.now || new Date(),
        searchPlacesFn: deps.searchPlacesFn || searchPlaces,
        weatherServiceFn: deps.weatherServiceFn || getWeatherForecast,
      });
    },
    {
      name: 'getForecast',
      description:
        'Get weather forecast for a destination and date (YYYY-MM-DD). Only available for dates within the next 5 days.',
      schema: z.object({
        place: z.string().describe('The destination or city name'),
        date: z.string().describe('Target date in YYYY-MM-DD format'),
      }),
    }
  );
}

/**
 * Calls the Travel Assistant LLM with optional tools, retry wrapper, and 503 error mapping.
 *
 * @param {Object} params
 * @param {string} params.message - Sanitized user message
 * @param {Array} [params.history=[]] - Sanitized conversation history
 * @param {string} [params.tripHint=''] - Formatted trip context hint
 * @param {Object} [params.deps={}] - Dependency injection for testing
 * @returns {Promise<{ reply: string, sources: Array<{ type: string, provider: string, date: string, place?: string }> }>}
 */
export async function callTravelAssistant({
  message,
  history = [],
  tripHint = '',
  deps = {},
}) {
  const sources = [];
  const systemPrompt = getAssistantSystemPrompt(tripHint);

  const apiKey = process.env.GROQ_API_KEY;

  // Offline / Demo mode when GROQ_API_KEY is absent
  if (!apiKey) {
    const hasWeatherQuery = /\b(weather|forecast|rain|temperature|climate)\b/i.test(message);

    if (hasWeatherQuery) {
      // Offline weather demonstration
      const destinationHint = tripHint.match(/Destination:\s*([^\n]+)/i)?.[1]?.trim();
      const placeMatch = message.match(/(?:in|at|for)\s+([A-Za-z\s]+?)(?:\s+(?:tomorrow|today|\d{4}-\d{2}-\d{2}))?$/i);
      const place = placeMatch ? placeMatch[1].trim() : destinationHint || 'Goa';
      const todayStr = new Date().toISOString().slice(0, 10);

      const toolResult = await runForecastLookup({
        place,
        date: todayStr,
        sources,
        now: deps.now || new Date(),
        searchPlacesFn: deps.searchPlacesFn || searchPlaces,
        weatherServiceFn: deps.weatherServiceFn || getWeatherForecast,
      });

      return {
        reply: `Here is the current forecast information:\n${toolResult}\n\nSafe travels!`,
        sources,
      };
    }

    return {
      reply:
        "I am Travalastic's Travel Assistant. I can help answer questions about destinations, food, packing, weather, safety, visas, and general travel budgeting. Safe travels!",
      sources: [],
    };
  }

  const forecastTool = createForecastTool(sources, deps);

  // Build messages array
  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  let rawReply = '';
  const primaryModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const fallbackModel = 'openai/gpt-oss-20b';

  const runWithModel = async (modelName) => {
    const chat = new ChatGroq({
      apiKey,
      model: modelName,
      temperature: 0.3,
    });

    let toolCapable = true;
    let modelWithTools;
    try {
      modelWithTools = chat.bindTools([forecastTool]);
    } catch {
      toolCapable = false;
    }

    if (!toolCapable) {
      const res = await chat.invoke(formattedMessages);
      return typeof res.content === 'string' ? res.content : res.content?.[0]?.text || '';
    }

    let response;
    try {
      response = await modelWithTools.invoke(formattedMessages);
    } catch (bindErr) {
      console.warn(`Model ${modelName} tool invocation failed, retrying without tools:`, bindErr.message);
      const plainRes = await chat.invoke(formattedMessages);
      return typeof plainRes.content === 'string' ? plainRes.content : plainRes.content?.[0]?.text || '';
    }

    // Handle tool calls if returned
    if (Array.isArray(response?.tool_calls) && response.tool_calls.length > 0) {
      const toolMessages = [];
      const callsToRun = response.tool_calls.slice(0, MAX_TOOL_CALLS);

      for (const call of callsToRun) {
        let output;
        try {
          output = await forecastTool.invoke(call.args);
        } catch (toolErr) {
          output = `Weather tool error: ${toolErr.message}`;
        }
        toolMessages.push(
          new ToolMessage({
            tool_call_id: call.id,
            content: typeof output === 'string' ? output : JSON.stringify(output),
          })
        );
      }

      const followupMessages = [...formattedMessages, response, ...toolMessages];
      const finalRes = await chat.invoke(followupMessages);
      return typeof finalRes.content === 'string' ? finalRes.content : finalRes.content?.[0]?.text || '';
    }

    return typeof response.content === 'string' ? response.content : response.content?.[0]?.text || '';
  };

  try {
    rawReply = await invokeWithRetry(() => runWithModel(primaryModel));
  } catch (primaryErr) {
    console.warn(`ChatGroq assistant primary model error (${primaryModel}), attempting fallback:`, primaryErr.message);
    try {
      rawReply = await invokeWithRetry(() => runWithModel(fallbackModel));
    } catch (fallbackErr) {
      console.error('ChatGroq assistant fallback model error:', fallbackErr.message);
      const serviceError = new Error('Travel Assistant is temporarily unavailable. Please try again shortly.');
      serviceError.status = 503;
      throw serviceError;
    }
  }

  // Cap reply length
  const reply = rawReply ? rawReply.trim().slice(0, MAX_REPLY_LENGTH) : '';

  return {
    reply,
    sources,
  };
}

export default {
  validateAssistantRequest,
  buildTripHint,
  isDateWithinForecastWindow,
  runForecastLookup,
  createForecastTool,
  callTravelAssistant,
  MAX_REPLY_LENGTH,
  MAX_TOOL_CALLS,
  TOOL_TIMEOUT_MS,
  FORECAST_WINDOW_DAYS,
};

