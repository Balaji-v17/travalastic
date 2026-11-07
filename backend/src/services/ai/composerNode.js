import 'dotenv/config';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';

/**
 * Zod schema for structured activity per Step B:2.
 * Output schema per activity:
 * { title, description, timeOfDay, kind: 'place' | 'meal' | 'transit' | 'rest', placeRef?: <candidate id> }
 */
export const ActivitySchema = z.object({
  title: z.string().describe('Title or name of the activity, attraction, or experience'),
  description: z
    .string()
    .describe('Description of the activity. Only use facts present in candidate record (type, note, best time). For meals/transit/rest, do NOT name a specific restaurant, shop, tour operator, price or opening hours.'),
  timeOfDay: z
    .string()
    .describe('Time of day or timeframe (e.g. "Morning", "Afternoon", "Evening", or "Night")'),
  kind: z
    .enum(['place', 'meal', 'transit', 'rest'])
    .describe('Activity kind: "place" (must reference a candidate id), "meal", "transit", or "rest"'),
  placeRef: z
    .string()
    .nullable()
    .optional()
    .describe('Exact candidate ID string from the verified candidate places list. Required if kind is "place".'),
});

/**
 * Zod schema for each day in the itinerary.
 * Each day contains dayNumber, theme (theme generated from day\'s places), activities, estimatedCostINR, and accommodationSuggestion.
 */
export const DayPlanSchema = z.object({
  dayNumber: z.number().describe('The day number of the trip (e.g. 1, 2, 3)'),
  theme: z
    .string()
    .describe('A short descriptive theme generated from that day\'s place activities (e.g. "Cliff walks and beaches")'),
  activities: z.array(ActivitySchema).describe('Array of structured activities planned for this day'),
  estimatedCostINR: z.number().describe('Estimated stay/accommodation cost for this day in INR; 0 if no overnight stay (last day)'),
  accommodationSuggestion: z
    .string()
    .nullable()
    .optional()
    .describe('Recommended accommodation for overnight stay on this day, or null/empty if departure day with no overnight stay'),
});

/**
 * Top-level Zod schema for structured output.
 */
export const ItinerarySchema = z.object({
  days: z.array(DayPlanSchema).describe('Array of daily itinerary plans'),
});

/**
 * Strips specific commercial restaurant, cafe, or shop names from meal titles/descriptions
 * to enforce the rule: meals must not name a specific restaurant, shop, tour operator, price or opening hours.
 */
export function sanitizeMealActivity(act) {
  let title = (act.title || '').trim();
  let description = (act.description || '').trim();

  // Pattern matching specific restaurant/cafe/dhaba/bistro naming like:
  // "Lunch at Fisherman's Cove", "Dinner at Cafe Del Mar", "Breakfast at Darjeeling Bakery"
  const restaurantNamePattern = /\b(at|in|from)\s+([A-Z][a-zA-Z0-9'&.-]+(?:\s+[A-Z][a-zA-Z0-9'&.-]+)*\s+(?:Restaurant|Cafe|Café|Bistro|Dhaba|Bar|Grill|Kitchen|Eatery|Bakery|Diner|Lounge))\b/i;
  const specificAtPattern = /\b(Lunch|Dinner|Breakfast)\s+at\s+([A-Z][a-zA-Z0-9'&.-]+(?:\s+[A-Z][a-zA-Z0-9'&.-]+)*)/i;

  if (restaurantNamePattern.test(title)) {
    title = title.replace(restaurantNamePattern, '$1 a local eatery');
  } else if (specificAtPattern.test(title)) {
    const match = title.match(specificAtPattern);
    const mealType = match[1];
    const placeName = match[2];
    // If the name isn't generic words like "a local spot", "local restaurant"
    if (!/local|hotel|guesthouse|resort|leisure/i.test(placeName)) {
      title = `${mealType} at a local eatery`;
    }
  }

  // Remove prices (e.g. ₹500, Rs. 500, 500 INR, $20) and opening hours (e.g. 9 AM - 5 PM)
  description = description
    .replace(/(?:₹|Rs\.?|INR|\$)\s*\d+(?:,\d+)*(?:\s*-\s*(?:₹|Rs\.?|INR|\$)?\s*\d+(?:,\d+)*)?/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)\s*-\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b/gi, '')
    .trim();

  return { title, description };
}

/**
 * Validates and grounds itinerary days against the candidate places list.
 * Enforces:
 * - kind: 'place' MUST reference a candidate id; hallucinated refs are repaired or converted to plain 'rest' item ("Free time")
 * - Coordinates are COPIED from the candidate by code (model never supplies lat/lon)
 * - Max place activities/day based on pace (Balanced = 3, Relaxed = 2, Packed = 4)
 * - Meal activities cannot name specific restaurants or prices
 * - Last day has no overnight stay (accommodationSuggestion = null, estimatedCostINR = 0)
 * - Computes grounding metadata: { candidateCount, sources, limited: boolean } (limited if distinct candidates used < 5)
 *
 * @param {Array<Object>} days - Array of DayPlan objects
 * @param {Array<Object>} candidates - Candidate places list [{ id, name, type, lat, lon, source, note }]
 * @param {Object} [options] - Options (pace, totalDays)
 * @returns {{ days: Array<Object>, grounding: { candidateCount: number, sources: string[], limited: boolean } }}
 */
export function validateAndGroundItinerary(days = [], candidates = [], options = {}) {
  if (!Array.isArray(days)) {
    return {
      days: [],
      grounding: { candidateCount: candidates?.length || 0, sources: [], limited: true },
    };
  }

  const candidateList = Array.isArray(candidates) ? candidates : [];
  const candidateMap = new Map();
  const candidateNameMap = new Map();

  for (const c of candidateList) {
    if (!c) continue;
    const cid = String(c.id || c.placeId || '').trim();
    if (cid) {
      candidateMap.set(cid, c);
      candidateMap.set(cid.toLowerCase(), c);
    }
    if (c.name) {
      candidateNameMap.set(c.name.toLowerCase().trim(), c);
    }
  }

  const pace = (options.pace || 'balanced').toLowerCase();
  const maxPlacesPerDay = pace === 'relaxed' ? 2 : pace === 'packed' ? 4 : 3;
  const distinctCandidatesUsed = new Set();
  const totalDays = days.length;

  const processedDays = days.map((day, dayIdx) => {
    if (!day || !Array.isArray(day.activities)) {
      return day;
    }

    const isLastDay = dayIdx === totalDays - 1 && totalDays > 1;
    let placeCountForDay = 0;
    const dayPlaces = [];

    const processedActivities = day.activities.map((act) => {
      let title = (act.title || act.name || '').trim();
      let description = (act.description || '').trim();
      const timeOfDay = act.timeOfDay || act.suggestedTime || 'Morning';
      let kind = (act.kind || '').toLowerCase().trim();
      let rawRef = act.placeRef != null ? String(act.placeRef).trim() : act.placeId != null ? String(act.placeId).trim() : null;

      if (!['place', 'meal', 'transit', 'rest'].includes(kind)) {
        if (rawRef && candidateMap.has(rawRef)) {
          kind = 'place';
        } else if (/lunch|dinner|breakfast|meal|snack|dining|food/i.test(title)) {
          kind = 'meal';
        } else if (/transfer|flight|train|bus|ferry|drive|travel|arrival|departure/i.test(title)) {
          kind = 'transit';
        } else {
          kind = 'rest';
        }
      }

      if (kind === 'meal') {
        const sanitized = sanitizeMealActivity({ title, description });
        return {
          title: sanitized.title,
          name: sanitized.title,
          description: sanitized.description,
          timeOfDay,
          suggestedTime: timeOfDay,
          kind: 'meal',
          placeRef: null,
          placeId: null,
          location: null,
        };
      }

      if (kind === 'transit' || kind === 'rest') {
        return {
          title,
          name: title,
          description,
          timeOfDay,
          suggestedTime: timeOfDay,
          kind,
          placeRef: null,
          placeId: null,
          location: null,
        };
      }

      // kind === 'place'
      // 1. Check pace limit: if day already reached max places, convert excess to rest
      if (placeCountForDay >= maxPlacesPerDay) {
        return {
          title: 'Free time',
          name: 'Free time',
          description: 'Free time to relax and explore at your own pace.',
          timeOfDay,
          suggestedTime: timeOfDay,
          kind: 'rest',
          placeRef: null,
          placeId: null,
          location: null,
        };
      }

      // 2. Validate placeRef
      let matchedCandidate = null;
      if (rawRef && candidateMap.has(rawRef)) {
        matchedCandidate = candidateMap.get(rawRef);
      } else if (rawRef && candidateMap.has(rawRef.toLowerCase())) {
        matchedCandidate = candidateMap.get(rawRef.toLowerCase());
      } else {
        // Attempt repair: match candidate name in placeRef or title
        if (rawRef && candidateNameMap.has(rawRef.toLowerCase())) {
          matchedCandidate = candidateNameMap.get(rawRef.toLowerCase());
        } else {
          const lowerTitle = title.toLowerCase();
          for (const [candName, cand] of candidateNameMap.entries()) {
            if (lowerTitle.includes(candName) || candName.includes(lowerTitle)) {
              matchedCandidate = cand;
              break;
            }
          }
        }
      }

      // 3. If invalid / hallucinated ref: convert to plain rest item "Free time"
      if (!matchedCandidate) {
        return {
          title: 'Free time',
          name: 'Free time',
          description: 'Free time to relax and explore at your own pace.',
          timeOfDay,
          suggestedTime: timeOfDay,
          kind: 'rest',
          placeRef: null,
          placeId: null,
          location: null,
        };
      }

      // 4. Valid place candidate: COPY coordinates directly from candidate record
      placeCountForDay++;
      distinctCandidatesUsed.add(matchedCandidate.id);
      dayPlaces.push(matchedCandidate.name);

      const lat = matchedCandidate.lat != null ? Number(matchedCandidate.lat) : null;
      const lon = matchedCandidate.lon != null ? Number(matchedCandidate.lon) : null;

      return {
        title,
        name: title,
        description,
        timeOfDay,
        suggestedTime: timeOfDay,
        kind: 'place',
        placeRef: matchedCandidate.id,
        placeId: matchedCandidate.id,
        location: {
          lat: !isNaN(lat) ? lat : null,
          lon: !isNaN(lon) ? lon : null,
          placeName: matchedCandidate.name,
        },
      };
    });

    // Theme generation from day's place activities if missing or generic
    let theme = (day.theme || '').trim();
    if (!theme || /day\s*\d+/i.test(theme)) {
      if (dayPlaces.length > 0) {
        theme = dayPlaces.slice(0, 2).join(' and ');
      } else {
        theme = `Exploration and Leisure`;
      }
    }

    // Overnight stay & cost: last day has no stay and no stay cost
    let accommodationSuggestion = day.accommodationSuggestion || null;
    let estimatedCostINR = day.estimatedCostINR != null ? Number(day.estimatedCostINR) : 0;

    if (isLastDay) {
      accommodationSuggestion = null;
      estimatedCostINR = 0;
    }

    return {
      ...day,
      theme,
      accommodationSuggestion,
      estimatedCostINR,
      activities: processedActivities,
    };
  });

  const sources = Array.from(
    new Set(candidateList.map((c) => c.source).filter(Boolean))
  );

  const grounding = {
    candidateCount: candidateList.length,
    sources,
    limited: distinctCandidatesUsed.size < 5,
    distinctUsedCount: distinctCandidatesUsed.size,
  };

  return {
    days: processedDays,
    grounding,
  };
}

// Backward compatibility alias for attachGroundingLocations
export const attachGroundingLocations = (days, attractions = []) => {
  const { days: groundedDays } = validateAndGroundItinerary(days, attractions);
  return groundedDays;
};
export const geocodeItineraryActivities = attachGroundingLocations;

/**
 * Builds fallback days when LLM call fails, strictly using provided candidates.
 */
export const buildFallbackItineraryDays = (state, candidates = []) => {
  const destination = state?.destination || 'Destination';
  const tripDays = state?.days || 3;
  const budget = state?.budgetEstimate || 30000;
  const dailyRate = Math.round(budget / tripDays);
  const candidatePool = Array.isArray(candidates) && candidates.length > 0 ? [...candidates] : [];

  const days = [];
  for (let d = 1; d <= tripDays; d++) {
    const isLastDay = d === tripDays && tripDays > 1;
    const dayPlaces = [];
    const activities = [];

    // Morning place from candidatePool
    if (candidatePool.length > 0) {
      const place = candidatePool.shift();
      dayPlaces.push(place.name);
      activities.push({
        title: `Visit ${place.name}`,
        description: `Explore ${place.name} (${place.type || 'Attraction'}).`,
        timeOfDay: 'Morning',
        kind: 'place',
        placeRef: place.id,
      });
    } else {
      activities.push({
        title: 'Morning Walk',
        description: `Relaxing morning stroll around ${destination}.`,
        timeOfDay: 'Morning',
        kind: 'rest',
        placeRef: null,
      });
    }

    // Afternoon meal
    activities.push({
      title: 'Lunch at a local eatery',
      description: 'Enjoy regional dishes and refreshments.',
      timeOfDay: 'Afternoon',
      kind: 'meal',
      placeRef: null,
    });

    // Afternoon place or rest
    if (candidatePool.length > 0) {
      const place = candidatePool.shift();
      dayPlaces.push(place.name);
      activities.push({
        title: `Explore ${place.name}`,
        description: `Discover ${place.name} (${place.type || 'Attraction'}).`,
        timeOfDay: 'Afternoon',
        kind: 'place',
        placeRef: place.id,
      });
    } else {
      activities.push({
        title: 'Free time',
        description: 'Free time to relax and explore at your own pace.',
        timeOfDay: 'Afternoon',
        kind: 'rest',
        placeRef: null,
      });
    }

    // Evening
    if (isLastDay) {
      activities.push({
        title: 'Departure Preparation',
        description: `Conclude your visit to ${destination} and prepare for departure.`,
        timeOfDay: 'Evening',
        kind: 'transit',
        placeRef: null,
      });
    } else {
      activities.push({
        title: 'Dinner at a local restaurant',
        description: 'Casual evening dining featuring local cuisine.',
        timeOfDay: 'Evening',
        kind: 'meal',
        placeRef: null,
      });
    }

    const theme = dayPlaces.length > 0 ? dayPlaces.join(' and ') : `${destination} Highlights`;
    days.push({
      dayNumber: d,
      theme,
      activities,
      estimatedCostINR: isLastDay ? 0 : dailyRate,
      accommodationSuggestion: isLastDay ? null : `Comfortable stay in central ${destination}`,
    });
  }

  return days;
};

/**
 * Composer Node for LangGraph.
 * Feeds ONLY the verified candidate places list to the planner prompt.
 * Employs strict in-code validation, coordinate copy, pace enforcement, and grounding calculation.
 * Writes result to state.itinerary and state.grounding.
 */
export const composerNode = async (state) => {
  const apiKey = process.env.GROQ_API_KEY;

  const tripDays =
    state?.days ||
    (state?.startDate && state?.endDate
      ? Math.max(1, Math.round((new Date(state.endDate) - new Date(state.startDate)) / (1000 * 60 * 60 * 24)))
      : 3);

  const budget = state?.budgetEstimate || 30000;
  const perDayBudget = Math.round(budget / Math.max(1, tripDays - 1));

  const rawInterests = state?.interests;
  const interestsList =
    Array.isArray(rawInterests) && rawInterests.length > 0
      ? rawInterests.join(', ')
      : typeof rawInterests === 'string' && rawInterests.trim()
      ? rawInterests.trim()
      : 'not specified';

  const candidates = Array.isArray(state?.attractions) ? state.attractions : [];
  const formattedCandidates =
    candidates.length > 0
      ? candidates
          .map(
            (c) =>
              `- [candidateId: "${c.id || c.placeId}"] ${c.name} (type: ${c.type || 'Attraction'}${c.note ? `, note: ${c.note}` : ''})`
          )
          .join('\n')
      : '(No verified candidates found for this destination)';

  const systemPrompt = `You are an expert travel planner assistant.
Your task is to create a coherent, realistic day-by-day travel plan based exclusively on the provided candidate places.

STRICT GROUNDING & CANDIDATE RULES:
1. ONLY USE CANDIDATES FROM THE PROVIDED CANDIDATE LIST:
   - For every activity with kind: "place", you MUST provide placeRef exactly matching one of the candidateId strings from the Candidate Places List.
   - NEVER invent or name a place, attraction, viewpoint, beach, temple, or venue that is not in the Candidate Places List.
   - If you want an activity that is not at one of the candidate places, set kind: "meal", "transit", or "rest" with placeRef: null.
2. MEALS, TRANSIT & REST:
   - Meals, transit, and rest activities MUST have placeRef: null.
   - Do NOT name a specific restaurant, cafe, shop, tour operator, price, or opening hours. Use generic descriptions (e.g. "Lunch at a local cafe", "Evening dining at a traditional restaurant").
3. DESCRIPTIONS:
   - For place activities, only use facts present in the candidate record (type, note, best time). Do not invent tours, boat charters, sessions, or events unless explicitly supported by the candidate record.
4. DAY HEADINGS & STAY:
   - In 'theme' for each day, generate a descriptive theme from that day's place activities (e.g. "Cliff walks and beaches"). Do NOT mention accommodation in the theme.
   - In 'accommodationSuggestion', suggest suitable accommodation for overnight stays on days 1 to ${tripDays - 1}.
   - On the LAST day (Day ${tripDays}, departure day), there is NO overnight stay: set accommodationSuggestion to null or empty, and estimatedCostINR to 0.
5. BUDGET ALLOCATION:
   - Total budget: ${budget} INR. Allocate stay cost estimatedCostINR for days with overnight stays (~${perDayBudget} INR/night). Last day estimatedCostINR MUST be 0.
6. PACE:
   - Maximum 3 place activities per day for balanced pace.`;

  const userPrompt = `Trip Context:
- Destination: ${state?.destination || 'N/A'}
- Dates: ${state?.startDate || 'N/A'} to ${state?.endDate || 'N/A'} (${tripDays} days)
- Interests: ${interestsList}
- Total Budget: ${budget} INR

Verified Candidate Places List:
${formattedCandidates}

Please produce a day-by-day plan strictly following the schema and rules. For kind: "place", placeRef MUST match a candidateId above.`;

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

    const rawDays = result?.days || (Array.isArray(result) ? result : []);
    if (Array.isArray(rawDays) && rawDays.length > 0) {
      const { days: groundedDays, grounding } = validateAndGroundItinerary(rawDays, candidates, {
        pace: state?.pace || 'balanced',
      });
      return {
        itinerary: groundedDays,
        grounding,
      };
    }

    throw new Error('Structured output did not contain valid days array');
  } catch (error) {
    console.warn('ChatGroq composer error, attempting secondary fallback or heuristic:', error.message);

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

        const rawDays = secondaryResult?.days || (Array.isArray(secondaryResult) ? secondaryResult : []);
        if (Array.isArray(rawDays) && rawDays.length > 0) {
          const { days: groundedDays, grounding } = validateAndGroundItinerary(rawDays, candidates, {
            pace: state?.pace || 'balanced',
          });
          return {
            itinerary: groundedDays,
            grounding,
          };
        }
      } catch (secErr) {
        console.warn('Secondary Groq model error:', secErr.message);
      }
    }

    const fallbackDays = buildFallbackItineraryDays(state, candidates);
    const { days: groundedFallback, grounding } = validateAndGroundItinerary(fallbackDays, candidates, {
      pace: state?.pace || 'balanced',
    });
    return {
      itinerary: groundedFallback,
      grounding,
    };
  }
};

export default composerNode;
