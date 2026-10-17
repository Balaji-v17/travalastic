import 'dotenv/config';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';

/**
 * Zod schema for structured activity.
 * Contains title, description, optional suggestedTime, and optional placeId.
 */
export const ActivitySchema = z.object({
  title: z.string().describe('Title or name of the activity, attraction, or experience'),
  description: z
    .string()
    .describe('Detailed description of what to do or see; only name places that exist in the provided verified places list'),
  suggestedTime: z
    .string()
    .nullable()
    .optional()
    .describe('Optional suggested time of day or timeframe (e.g. "Morning", "Afternoon", "Evening", or "10:00 AM")'),
  placeId: z
    .string()
    .nullable()
    .optional()
    .describe('Exact placeId string from the verified places list, or null for generic activities'),
});

/**
 * Zod schema for each day in the itinerary.
 * Each day contains dayNumber, activities (array of structured activity objects), estimatedCostINR, and accommodationSuggestion.
 */
export const DayPlanSchema = z.object({
  dayNumber: z.number().describe('The day number of the trip (e.g. 1, 2, etc.)'),
  activities: z.array(ActivitySchema).describe('Array of structured activities planned for this day'),
  estimatedCostINR: z.number().describe('Estimated cost for this day in INR'),
  accommodationSuggestion: z.string().describe('Recommended accommodation or hotel for this day'),
});

/**
 * Top-level Zod schema for structured output.
 */
export const ItinerarySchema = z.object({
  days: z.array(DayPlanSchema).describe('Array of daily itinerary plans'),
});

/**
 * Attaches real places to itinerary activities by reference (placeId).
 * Looks up placeId in the attractions list passed to the composer.
 * If matched: attaches location = { lat, lon, placeName }.
 * If placeId is null, or if invalid / not found in list: sets location: null and placeId: null, and keeps description as-is.
 * Logs the count and grounded rate per generation.
 *
 * @param {Array<Object>} days - Array of DayPlan objects
 * @param {Array<Object>} attractions - List of verified attractions { placeId, name, category, lat, lon }
 * @returns {Array<Object>} Days with grounded activities
 */
export const attachGroundingLocations = (days, attractions = []) => {
  if (!Array.isArray(days)) return [];

  // Build map of verified attractions by placeId for fast lookup
  const attractionsMap = new Map();
  if (Array.isArray(attractions)) {
    for (const attr of attractions) {
      if (attr && attr.placeId != null) {
        attractionsMap.set(String(attr.placeId).trim(), attr);
      }
    }
  }

  let groundedCount = 0;
  let ungroundedCount = 0;

  const processedDays = days.map((day) => {
    if (!day || !Array.isArray(day.activities)) {
      return day;
    }

    const processedActivities = day.activities.map((act) => {
      let title = '';
      let description = '';
      let suggestedTime = null;
      let rawPlaceId = null;

      if (typeof act === 'string') {
        const timeMatch = act.match(
          /^(Morning|Afternoon|Evening|Night|\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*:\s*(.*)$/i
        );
        if (timeMatch) {
          title = timeMatch[2].trim();
          description = act.trim();
          suggestedTime = timeMatch[1].trim();
        } else {
          title = act.trim();
          description = act.trim();
        }
      } else if (act && typeof act === 'object') {
        title = (act.title || act.name || '').trim();
        description = (act.description || '').trim();
        suggestedTime = act.suggestedTime || null;
        rawPlaceId = act.placeId != null ? String(act.placeId).trim() : null;
      } else {
        return act;
      }

      // Check if placeId is explicit null/empty/sentinel
      if (
        !rawPlaceId ||
        rawPlaceId.toLowerCase() === 'null' ||
        rawPlaceId.toLowerCase() === 'undefined' ||
        rawPlaceId.toLowerCase() === 'none' ||
        rawPlaceId.toLowerCase() === 'n/a'
      ) {
        rawPlaceId = null;
      }

      let matchedPlace = null;
      if (rawPlaceId && attractionsMap.has(rawPlaceId)) {
        matchedPlace = attractionsMap.get(rawPlaceId);
      }

      let location = null;
      let finalPlaceId = null;

      if (matchedPlace) {
        finalPlaceId = matchedPlace.placeId;
        const lat = matchedPlace.lat ?? matchedPlace.latitude ?? null;
        const lon = matchedPlace.lon ?? matchedPlace.longitude ?? null;
        location = {
          lat: lat != null && !isNaN(Number(lat)) ? Number(lat) : null,
          lon: lon != null && !isNaN(Number(lon)) ? Number(lon) : null,
          placeName: matchedPlace.name || title,
        };
        groundedCount++;
      } else {
        // Disobeyed, invalid, or null placeId: set location: null and placeId: null, keep description as-is
        finalPlaceId = null;
        location = null;
        ungroundedCount++;
      }

      return {
        title,
        name: title, // backward compatibility for frontend and other services
        description,
        suggestedTime,
        placeId: finalPlaceId,
        location,
      };
    });

    return {
      ...day,
      activities: processedActivities,
    };
  });

  const total = groundedCount + ungroundedCount;
  const rate = total > 0 ? ((groundedCount / total) * 100).toFixed(1) : '0.0';
  console.log(
    `[Itinerary Grounding] Grounded activities: ${groundedCount}/${total} (${rate}%), ungrounded: ${ungroundedCount}`
  );

  return processedDays;
};

// Backward compatibility alias for any existing imports
export const geocodeItineraryActivities = attachGroundingLocations;

/**
 * Helper to build a fallback day-by-day plan when LLM call is unavailable.
 * @param {Object} state 
 * @returns {Array<Object>}
 */
export const buildFallbackItineraryDays = (state) => {
  const destination = state?.destination || 'Destination';
  const startDate = state?.startDate || new Date().toISOString().slice(0, 10);
  const endDate = state?.endDate || startDate;
  const interests = Array.isArray(state?.interests) && state.interests.length > 0
    ? state.interests.join(', ')
    : 'sightseeing and culture';
  const attractions = Array.isArray(state?.attractions) ? state.attractions : [];
  const accommodationOptions = Array.isArray(state?.accommodationOptions) ? state.accommodationOptions : [];
  const personalizedContent = Array.isArray(state?.personalizedContent) ? state.personalizedContent : [];

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = state?.days || Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) || 1);
  const totalBudget =
    state?.budgetEstimate != null
      ? state.budgetEstimate
      : diffDays * (state?.budgetTier === 'luxury' ? 10000 : state?.budgetTier === 'budget' ? 1500 : 4000);
  const dailyCost = Math.round(totalBudget / diffDays);

  const defaultHotel =
    accommodationOptions[0]?.name ||
    (state?.budgetTier === 'luxury'
      ? `5-Star Luxury Resort & Spa in ${destination}`
      : state?.budgetTier === 'budget'
      ? `Budget Traveler Hostel / Guesthouse in ${destination}`
      : `Boutique Hotel & Suites in ${destination}`);

  const days = [];
  const isNightlife = interests.toLowerCase().includes('nightlife');
  const hasHiddenGem = interests.toLowerCase().includes('hidden gem') || (state?.rawRequest || '').toLowerCase().includes('hidden gem');

  for (let i = 1; i <= diffDays; i++) {
    const attractionObj = attractions[i - 1];
    const attractionName = attractionObj?.name || `${destination} Central Area`;
    const blurb = personalizedContent[i - 1]?.text || `Enjoy local experiences tailored to ${interests}.`;
    const gemActivityDesc = hasHiddenGem && i === Math.min(2, diffDays)
      ? `Explore an authentic hidden gem off the beaten path in ${destination} for a unique local experience.`
      : `${blurb.slice(0, 120)}...`;
    const eveningActivityDesc = isNightlife
      ? `Experience the vibrant nightlife at local bars, cocktail lounges, and night entertainment districts in ${destination}.`
      : `Dinner at a popular local restaurant enjoying the atmosphere in ${destination}.`;

    days.push({
      dayNumber: i,
      activities: [
        {
          title: `Explore ${attractionName}`,
          name: `Explore ${attractionName}`,
          description: `Discover local sights, landmarks, and highlights around ${attractionName} in ${destination}.`,
          suggestedTime: 'Morning',
          placeId: attractionObj?.placeId || null,
          location: null,
        },
        {
          title: hasHiddenGem && i === Math.min(2, diffDays) ? `Hidden Gem in ${destination}` : `${destination} Highlights`,
          name: hasHiddenGem && i === Math.min(2, diffDays) ? `Hidden Gem in ${destination}` : `${destination} Highlights`,
          description: gemActivityDesc,
          suggestedTime: 'Afternoon',
          placeId: null,
          location: null,
        },
        {
          title: isNightlife ? `Nightlife & Evening Entertainment` : `Local Dining & Evening Stroll`,
          name: isNightlife ? `Nightlife & Evening Entertainment` : `Local Dining & Evening Stroll`,
          description: eveningActivityDesc,
          suggestedTime: 'Evening',
          placeId: null,
          location: null,
        },
      ],
      estimatedCostINR: dailyCost,
      accommodationSuggestion: defaultHotel,
    });
  }

  return days;
};

/**
 * Composer Node for LangGraph.
 * Combines destination, dates, budgetTier, interests, weather, attractions,
 * accommodationOptions, budgetEstimate, and personalizedContent into context.
 * Uses ChatGroq with .withStructuredOutput() to generate a coherent day-by-day plan.
 * Writes the result to state.itinerary.
 * @param {Object} state - Graph state containing all tool and personalization outputs
 * @returns {Promise<{itinerary: Array<Object>}>}
 */
export const composerNode = async (state) => {
  const apiKey = process.env.GROQ_API_KEY;

  const tripDays =
    state?.days ||
    (state?.startDate && state?.endDate
      ? Math.max(1, Math.round((new Date(state.endDate) - new Date(state.startDate)) / (1000 * 60 * 60 * 24)))
      : 3);

  const budget = state?.budgetEstimate || 50000;
  const perDayBudget = Math.round(budget / (state?.days || tripDays || 3));

  const interestsList =
    Array.isArray(state?.interests) && state.interests.length > 0
      ? state.interests.join(', ')
      : typeof state?.interests === 'string' && state.interests.trim()
      ? state.interests.trim()
      : 'sightseeing and culture';

  const attractions = Array.isArray(state?.attractions) ? state.attractions : [];
  const formattedAttractions = attractions.length > 0
    ? attractions
        .map(
          (a) =>
            `- [placeId: "${a.placeId}"] ${a.name}${a.category ? ` (${a.category})` : ''}`
        )
        .join('\n')
    : '(No verified attractions available for this destination)';

  const systemPrompt = `You are an expert travel planner assistant.
Your task is to create a coherent, realistic day-by-day travel plan based on the provided trip context.

You MUST strictly enforce the following rules:

1. STRICT INTEREST & HIGHLIGHT ADHERENCE:
   - Prioritize the user's explicit interests (${interestsList}).
   - At least 60-70% of suggested activities MUST directly match these interests. If "nightlife" is selected, evenings MUST feature bars, clubs, izakayas, night markets, or evening entertainment districts.
   - If the user requested "hidden gem" or "hidden gems", you MUST feature authentic, offbeat hidden gems and secret spots in the daily itinerary.

2. GROUNDED PLACES & VENUE RULES (STRICT):
   - You are provided with a verified list of attractions and landmarks for this destination, each having an exact "placeId" and name.
   - When an activity involves a specific venue or landmark, placeId MUST be the exact placeId from the provided list.
   - NEVER invent or hallucinate a venue, attraction, or landmark name that isn't in the provided list.
   - Generic activities (such as check-in, check-out, transit/travel, airport/station transfers, rest, relaxation, or meals without a named venue from the list) MUST have placeId: null.
   - In activity descriptions, only name places, venues, and landmarks that exist in the provided verified list.
   - Do NOT generate coordinates or location fields directly.

3. ACCOMMODATION & STAY SUGGESTIONS:
   - In accommodationSuggestion for each day, recommend suitable areas to stay and types of accommodation matching the user's requested budget tier (e.g. for budget: recommended guesthouses, boutique hostels, or budget rooms in central areas; for luxury: 5-star beach resorts).

4. CRITICAL BUDGET RULES:
- You have a strict budget of ${budget} INR total.
- This means you MUST allocate approximately ${perDayBudget} INR per day.
- Do NOT output a low default budget like 1500 INR. 
- The 'estimatedCostINR' for EACH day MUST be between ${Math.round(perDayBudget * 0.8)} INR and ${Math.round(perDayBudget * 1.2)} INR.
- Suggest hotels and activities that actually cost this amount (e.g., boutique hotels, upscale dining, premium club entry).

5. CONTEXT INTEGRATION & SCHEMA:
   - Incorporate the destination (${state?.destination || 'N/A'}), weather forecast, verified attractions, and personalized content blurbs into the daily schedule.
   - Output strictly structured output conforming to the itinerary schema with dayNumber, activities (array of objects with title, description, optional suggestedTime, and optional placeId), estimatedCostINR (number), and accommodationSuggestion (string) for each day.

6. FORMATTING & CHAT BUBBLE RULES:
   - In all activity descriptions, daily highlights, and replies, AVOID Markdown tables (| Col 1 | Col 2 |). Tables are an awkward fit for narrow mobile chat bubbles and itinerary cards. Prefer plain prose, clear section headings, or short bullet lists instead. Headings and bold text are supported, but do NOT format schedules or details as Markdown tables.`;

  const userPrompt = `Here is the gathered trip context and research data:
- Destination: ${state?.destination || 'N/A'}
- Dates: ${state?.startDate || 'N/A'} to ${state?.endDate || 'N/A'} (${tripDays} days)
- Budget Tier: ${state?.budgetTier || 'mid'}
- Total Budget Estimate: ${budget} INR (~${perDayBudget} INR/day)
- Interests: ${interestsList}
- Weather Forecast: ${JSON.stringify(state?.weather || {})}
- Accommodation Options: ${JSON.stringify(state?.accommodationOptions || [])}
- Personalized Content Blurbs: ${JSON.stringify(state?.personalizedContent || [])}
- Raw Request: "${state?.rawRequest || ''}"

Verified Attractions & Landmarks List (select placeId strictly from this list for venue/landmark activities):
${formattedAttractions}

Please create a detailed, day-by-day itinerary that strictly follows the rules above, focuses 60-70% on ${interestsList}, grounds specific venue activities using placeId from the verified list, and accurately targets between ${Math.round(perDayBudget * 0.8)} INR and ${Math.round(perDayBudget * 1.2)} INR for each day's estimatedCostINR.`;

  try {
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not defined in environment variables');
    }

    const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    const model = new ChatGroq({
      apiKey,
      model: modelName,
      temperature: 0.2,
    }).withStructuredOutput(ItinerarySchema);

    const result = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const days = result?.days || (Array.isArray(result) ? result : []);

    if (Array.isArray(days) && days.length > 0) {
      const groundedDays = attachGroundingLocations(days, attractions);
      return {
        itinerary: groundedDays,
      };
    }

    throw new Error('Structured output did not contain valid days array');
  } catch (error) {
    console.warn('ChatGroq composer error, attempting secondary fallback:', error.message);

    // Try secondary model openai/gpt-oss-20b if different
    if (apiKey && (process.env.GROQ_MODEL || 'openai/gpt-oss-120b') !== 'openai/gpt-oss-20b') {
      try {
        const secondaryModel = new ChatGroq({
          apiKey,
          model: 'openai/gpt-oss-20b',
          temperature: 0.2,
        }).withStructuredOutput(ItinerarySchema);

        const secondaryResult = await secondaryModel.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        const days = secondaryResult?.days || (Array.isArray(secondaryResult) ? secondaryResult : []);
        if (Array.isArray(days) && days.length > 0) {
          const groundedDays = attachGroundingLocations(days, attractions);
          return {
            itinerary: groundedDays,
          };
        }
      } catch (secErr) {
        console.warn('Secondary Groq model error:', secErr.message);
      }
    }

    const fallbackDays = buildFallbackItineraryDays(state);
    const groundedFallback = attachGroundingLocations(fallbackDays, attractions);
    return {
      itinerary: groundedFallback,
    };
  }
};

export default composerNode;
