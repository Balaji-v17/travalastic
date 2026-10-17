import 'dotenv/config';
import mongoose from 'mongoose';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';
import { DayPlanSchema, attachGroundingLocations } from './composerNode.js';
import { fetchExplorePlaces } from '../../routes/destinations.js';
import Itinerary, { findUserItinerary } from '../../models/Itinerary.js';
import { saveItineraryEditSnapshot } from '../undoService.js';
import { getBucketFromSuggestedTime, BUCKET_ORDER } from '../rescheduleService.js';

/**
 * Zod schema for regenerating a day when some activities are already marked done.
 * Extends DayPlanSchema with an optional blockedByDone flag.
 */
export const DayPlanWithDoneSchema = DayPlanSchema.extend({
  blockedByDone: z
    .boolean()
    .optional()
    .describe(
      'Set to true if the user request can only be satisfied by modifying, removing, or replacing an activity that is already marked done. Otherwise false or omit.'
    ),
});

/**
 * Pure function that merges preserved done activities with newly generated activities.
 * - Done activities stay exactly as stored (all fields, including location, placeId, and done),
 *   at their original positions (clamped to the new length).
 * - New activities fill the remaining positions ordered by time bucket (Morning, Afternoon, Evening, Night),
 *   keeping relative order within a bucket.
 * - Any new activity whose title matches a done activity's title (case-insensitive, trimmed) is dropped.
 *
 * @param {Array<Object>} oldActivities - Original activities before the edit
 * @param {Array<Object>} newActivities - Newly generated activities
 * @returns {Array<Object>} Merged activities array
 */
export function mergeDoneActivities(oldActivities = [], newActivities = []) {
  const safeOld = Array.isArray(oldActivities) ? oldActivities : [];
  const safeNew = Array.isArray(newActivities) ? newActivities : [];

  const doneEntries = [];
  for (let i = 0; i < safeOld.length; i++) {
    const act = safeOld[i];
    if (act && typeof act === 'object' && act.done === true) {
      const cloned =
        typeof act.toObject === 'function'
          ? act.toObject()
          : JSON.parse(JSON.stringify(act));
      doneEntries.push({
        originalIndex: i,
        activity: cloned,
      });
    }
  }

  // Done titles for case-insensitive matching
  const doneTitles = new Set(
    doneEntries
      .map((e) =>
        (e.activity.title || e.activity.name || (typeof e.activity === 'string' ? e.activity : '')).trim().toLowerCase()
      )
      .filter((t) => t.length > 0)
  );

  // Filter out any new activity whose title matches a done activity's title
  const filteredNew = [];
  for (let i = 0; i < safeNew.length; i++) {
    const act = safeNew[i];
    if (!act) continue;
    const rawTitle =
      typeof act === 'string'
        ? act
        : act.title || act.name || '';
    const trimmedTitle = rawTitle.trim().toLowerCase();
    if (trimmedTitle && doneTitles.has(trimmedTitle)) {
      continue; // Dropped duplicate title
    }

    const cloned =
      typeof act === 'string'
        ? {
            title: act,
            description: act,
            suggestedTime: null,
            placeId: null,
            location: null,
          }
        : typeof act.toObject === 'function'
        ? act.toObject()
        : JSON.parse(JSON.stringify(act));

    filteredNew.push({
      originalIndex: i,
      activity: cloned,
      bucket: getBucketFromSuggestedTime(cloned.suggestedTime),
    });
  }

  // If there are no done activities, return new activities ordered by bucket
  if (doneEntries.length === 0) {
    filteredNew.sort((a, b) => {
      const bIndexA = BUCKET_ORDER.indexOf(a.bucket);
      const bIndexB = BUCKET_ORDER.indexOf(b.bucket);
      if (bIndexA !== bIndexB) return bIndexA - bIndexB;
      return a.originalIndex - b.originalIndex;
    });
    return filteredNew.map((item) => item.activity);
  }

  // Sort filtered new activities by bucket (Morning, Afternoon, Evening, Night), keeping relative order
  filteredNew.sort((a, b) => {
    const bIndexA = BUCKET_ORDER.indexOf(a.bucket);
    const bIndexB = BUCKET_ORDER.indexOf(b.bucket);
    if (bIndexA !== bIndexB) return bIndexA - bIndexB;
    return a.originalIndex - b.originalIndex;
  });

  const totalLength = doneEntries.length + filteredNew.length;
  if (totalLength === 0) return [];

  // Determine positions of done activities:
  // Initial clamp to [0, totalLength - 1]
  const positions = doneEntries.map((e) =>
    Math.min(e.originalIndex, totalLength - 1)
  );

  // Backward pass to resolve collisions from clamping
  for (let i = positions.length - 2; i >= 0; i--) {
    if (positions[i] >= positions[i + 1]) {
      positions[i] = positions[i + 1] - 1;
    }
  }

  // Forward pass safety check
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] <= positions[i - 1]) {
      positions[i] = positions[i - 1] + 1;
    }
  }

  const result = new Array(totalLength);
  for (let i = 0; i < doneEntries.length; i++) {
    result[positions[i]] = doneEntries[i].activity;
  }

  let newPtr = 0;
  for (let i = 0; i < totalLength; i++) {
    if (result[i] === undefined) {
      result[i] = filteredNew[newPtr].activity;
      newPtr++;
    }
  }

  return result;
}

/**
 * Step 1 Schema: Identifies which day(s) are targeted and verifies the request action.
 */
export const EditAnalysisSchema = z.object({
  action: z
    .enum(['modify_days', 'add_day', 'remove_day', 'unclear'])
    .describe(
      'The category of the edit request: "modify_days" for updating existing days, "add_day" for adding/extending days, "remove_day" for deleting/removing days, or "unclear" if the request is vague, unmapped, or unrelated to itinerary changes.'
    ),
  targetDayNumbers: z
    .array(z.number())
    .describe(
      'The 1-indexed day numbers (e.g. [1] or [2, 3]) that should be modified. Return an empty array if action is add_day, remove_day, or unclear.'
    ),
  changeDescription: z
    .string()
    .describe(
      'A plain, concise description of the requested modification for the target day(s).'
    ),
});

/**
 * Helper to construct ChatGroq structured model
 */
const createGroqModel = (schema, modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b') => {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: modelName,
    temperature: 0.1,
  }).withStructuredOutput(schema);
};

/**
 * Heuristic fallback for Step 1 analysis in case LLM is unavailable
 */
const analyzeEditFallback = (editRequest, totalDays = 1) => {
  const text = editRequest.toLowerCase();

  if (
    text.includes('add a day') ||
    text.includes('add another day') ||
    text.includes('extra day') ||
    text.includes('extend trip') ||
    text.includes('one more day') ||
    text.includes('make it') && text.includes('days')
  ) {
    return {
      action: 'add_day',
      targetDayNumbers: [],
      changeDescription: 'Request to add day(s)',
    };
  }

  if (
    text.includes('remove day') ||
    text.includes('delete day') ||
    text.includes('drop day') ||
    text.includes('cut day') ||
    text.includes('shorten')
  ) {
    return {
      action: 'remove_day',
      targetDayNumbers: [],
      changeDescription: 'Request to remove day(s)',
    };
  }

  // Look for day numbers e.g. "day 2", "day 1 and 3"
  const dayMatches = [...text.matchAll(/\bday\s*(\d+)\b/g)];
  const dayNums = dayMatches
    .map((m) => parseInt(m[1], 10))
    .filter((n) => n >= 1 && n <= totalDays);

  if (dayNums.length > 0) {
    return {
      action: 'modify_days',
      targetDayNumbers: [...new Set(dayNums)],
      changeDescription: editRequest,
    };
  }

  return {
    action: 'unclear',
    targetDayNumbers: [],
    changeDescription: editRequest,
  };
};

/**
 * Modifies an existing itinerary document according to user instructions.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.itineraryId - Target itinerary ID
 * @param {string|mongoose.Types.ObjectId} params.userId - Requesting user ID for ownership check
 * @param {string} params.editRequest - Plain language modification request
 * @returns {Promise<{ success: boolean, itinerary?: Object, modifiedDays?: number[], changeDescription?: string, error?: string }>}
 */
export const editItinerary = async ({ itineraryId, userId, editRequest }) => {
  if (!itineraryId || !userId || !editRequest || typeof editRequest !== 'string' || !editRequest.trim()) {
    return {
      success: false,
      error: 'itineraryId, userId, and a non-empty editRequest are required',
    };
  }

  // Ownership verification (reusing findUserItinerary)
  const itinerary = await findUserItinerary(itineraryId, userId);
  if (!itinerary) {
    return {
      success: false,
      error: 'Itinerary not found',
    };
  }

  const existingDays = itinerary.days || [];
  if (existingDays.length === 0) {
    return {
      success: false,
      error: 'The itinerary has no days to edit.',
    };
  }

  const daysSummary = existingDays
    .map((d) => {
      const actSummary = (d.activities || [])
        .map((a) =>
          typeof a === 'string'
            ? a
            : `${a.name || ''}${a.suggestedTime ? ` (${a.suggestedTime})` : ''}: ${a.description || ''}`
        )
        .join('; ');
      return `Day ${d.dayNumber}: Activities: [${actSummary}], Cost: ₹${d.estimatedCostINR || 0}, Stay: ${d.accommodationSuggestion || 'N/A'}`;
    })
    .join('\n');

  // Step 1: Identify target days and action
  let analysis;
  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    try {
      const step1Model = createGroqModel(
        EditAnalysisSchema,
        process.env.GROQ_INTENT_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
      );

      analysis = await step1Model.invoke([
        {
          role: 'system',
          content: `You are an expert travel itinerary editor assistant.
Analyze the user's edit request against the current itinerary days.
Determine whether the user wants to:
- "modify_days": update, swap, replace, or alter activities/stay on existing days.
- "add_day": add one or more new days, extend trip duration, or add extra days to the trip.
- "remove_day": delete, drop, cancel, or remove one or more days.
- "unclear": request is vague, off-topic, not mapped to a specific day, or asks for something outside itinerary editing.

CRITICAL RULES:
1. If the user wants to add or remove days, set action to "add_day" or "remove_day" respectively.
2. If "modify_days", identify all exact 1-indexed dayNumber(s) affected and summarize the change.
3. If the request does not clearly map to an existing day, choose "unclear" with empty targetDayNumbers rather than guessing.`,
        },
        {
          role: 'user',
          content: `Destination: ${itinerary.destination || 'N/A'}
Total Days: ${existingDays.length}
Current Days Summary:
${daysSummary}

User Edit Request: "${editRequest.trim()}"`,
        },
      ]);
    } catch (err) {
      console.warn('ChatGroq step 1 edit analysis error, attempting secondary model:', err.message);
      try {
        const fallbackStep1 = createGroqModel(EditAnalysisSchema, 'openai/gpt-oss-20b');
        analysis = await fallbackStep1.invoke([
          {
            role: 'system',
            content:
              'Analyze the user edit request. Classify action as modify_days, add_day, remove_day, or unclear, and list targetDayNumbers.',
          },
          {
            role: 'user',
            content: `Total Days: ${existingDays.length}\n${daysSummary}\nRequest: "${editRequest.trim()}"`,
          },
        ]);
      } catch (secErr) {
        console.warn('Secondary Groq step 1 error:', secErr.message);
      }
    }
  }

  if (!analysis || !analysis.action) {
    analysis = analyzeEditFallback(editRequest, existingDays.length);
  }

  // Explicit scope restriction: Add / Remove days not supported
  if (analysis.action === 'add_day' || analysis.action === 'remove_day') {
    return {
      success: false,
      error:
        'Adding or removing days is not supported yet. You can modify activities or accommodations on existing days.',
      action: analysis.action,
    };
  }

  // If unclear or no day identified, return error without guessing
  if (
    analysis.action === 'unclear' ||
    !Array.isArray(analysis.targetDayNumbers) ||
    analysis.targetDayNumbers.length === 0
  ) {
    return {
      success: false,
      error: 'Could not clearly map edit request to an existing day in this itinerary.',
      action: 'unclear',
    };
  }

  // Validate day numbers exist in current itinerary
  const validDayNumbers = new Set(existingDays.map((d) => d.dayNumber));
  const invalidDays = analysis.targetDayNumbers.filter((num) => !validDayNumbers.has(num));

  if (invalidDays.length > 0) {
    return {
      success: false,
      error: `Requested day number(s) ${invalidDays.join(', ')} do not exist in this itinerary.`,
      action: 'unclear',
    };
  }

  // If ALL activities in the target day(s) are done, do not call LLM and do not create an undo snapshot
  const targetDays = analysis.targetDayNumbers.map((num) =>
    existingDays.find((d) => d.dayNumber === num)
  );
  const allTargetDaysDone =
    targetDays.length > 0 &&
    targetDays.every((d) => {
      const acts = d?.activities || [];
      return acts.length > 0 && acts.every((a) => a && typeof a === 'object' && a.done === true);
    });

  if (allTargetDaysDone) {
    return {
      success: false,
      reply: 'Everything on that day is already marked done, so I left it as it is.',
      error: 'Everything on that day is already marked done, so I left it as it is.',
    };
  }

  // Step 2: Regenerate each affected day using DayPlanSchema from composerNode
  // Retrieve cached destination attractions to ground regenerated activities
  let attractions = [];
  if (itinerary.destination) {
    try {
      const placesData = await fetchExplorePlaces(itinerary.destination);
      const rawPlaces = Array.isArray(placesData?.results)
        ? placesData.results
        : Array.isArray(placesData?.destinations)
        ? placesData.destinations
        : Array.isArray(placesData)
        ? placesData
        : [];
      attractions = rawPlaces
        .filter((p) => p && (p.placeId || p._id) && p.name)
        .map((p) => ({
          placeId: p.placeId || (p._id ? p._id.toString() : null),
          name: p.name.trim(),
          category: p.category || null,
          lat: p.lat != null ? Number(p.lat) : p.latitude != null ? Number(p.latitude) : null,
          lon: p.lon != null ? Number(p.lon) : p.longitude != null ? Number(p.longitude) : null,
        }));
    } catch (err) {
      console.warn('[editNode] Could not retrieve cached attractions:', err.message);
    }
  }

  const formattedAttractions = attractions.length > 0
    ? attractions
        .map(
          (a) =>
            `- [placeId: "${a.placeId}"] ${a.name}${a.category ? ` (${a.category})` : ''}`
        )
        .join('\n')
    : '(No verified attractions available for this destination)';

  const regeneratedDaysMap = new Map();
  const preservedDayNumbers = new Set();

  for (const dayNumber of analysis.targetDayNumbers) {
    const existingDay = existingDays.find((d) => d.dayNumber === dayNumber);
    const acts = existingDay?.activities || [];
    const doneActs = acts.filter((a) => a && typeof a === 'object' && a.done === true);
    const hasDone = doneActs.length > 0;
    const allDayDone = acts.length > 0 && doneActs.length === acts.length;

    if (allDayDone) {
      regeneratedDaysMap.set(dayNumber, existingDay);
      continue;
    }

    let regeneratedDay;

    if (!hasDone) {
      // 1. If NO activity in that day is done, change nothing. The day must go through exactly the same prompt and code path as today.
      if (apiKey) {
        try {
          const step2Model = createGroqModel(
            DayPlanSchema,
            process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
          );

          regeneratedDay = await step2Model.invoke([
            {
              role: 'system',
              content: `You are an expert travel planner assistant.
Your task is to regenerate ONLY Day ${dayNumber} of the itinerary to incorporate the user's requested changes.
You MUST:
1. Incorporate the requested change precisely.
2. Keep untouched parts of the day coherent, and stay aware of the day's original activities and cost as context.
3. Keep dayNumber exactly as ${dayNumber}.
4. Output strictly conforming to the DayPlanSchema with dayNumber, activities (array of objects with title, description, optional suggestedTime, and optional placeId), estimatedCostINR (number), and accommodationSuggestion (string).
5. GROUNDED PLACES & VENUE RULES (STRICT):
   - You are provided with a verified list of attractions and landmarks for this destination, each having an exact "placeId" and name.
   - When an activity involves a specific venue or landmark, placeId MUST be the exact placeId from the provided list.
   - NEVER invent or hallucinate a venue, attraction, or landmark name that isn't in the provided list.
   - Generic activities (such as check-in, check-out, transit/travel, airport/station transfers, rest, relaxation, or meals without a named venue from the list) MUST have placeId: null.
   - In activity descriptions, only name places, venues, and landmarks that exist in the provided verified list.
   - Do NOT generate coordinates or location fields directly.`,
            },
            {
              role: 'user',
              content: `Trip Destination: ${itinerary.destination || 'N/A'}
Budget Tier: ${itinerary.budgetTier || 'mid'}
Interests: ${Array.isArray(itinerary.interests) ? itinerary.interests.join(', ') : 'sightseeing'}

Verified Attractions & Landmarks List (select placeId strictly from this list for venue/landmark activities):
${formattedAttractions}

Original Day ${dayNumber} Details:
- Activities:
${(existingDay?.activities || [])
  .map((a) =>
    typeof a === 'string'
      ? `  * ${a}`
      : `  * ${a.title || a.name || ''}${a.suggestedTime ? ` (${a.suggestedTime})` : ''}: ${a.description || ''}`
  )
  .join('\n') || '  (none)'}
- Estimated Cost INR: ₹${existingDay?.estimatedCostINR || 0}
- Accommodation: ${existingDay?.accommodationSuggestion || 'N/A'}

Requested Change: ${analysis.changeDescription}
User's Message: "${editRequest.trim()}"

Please regenerate Day ${dayNumber}.`,
            },
          ]);
        } catch (err) {
          console.warn(`ChatGroq step 2 day ${dayNumber} error, trying secondary:`, err.message);
          try {
            const secondaryStep2 = createGroqModel(DayPlanSchema, 'openai/gpt-oss-20b');
            regeneratedDay = await secondaryStep2.invoke([
              {
                role: 'system',
                content: `Regenerate Day ${dayNumber} reflecting the requested change: ${analysis.changeDescription}. Output strictly conforming to DayPlanSchema with title, description, optional suggestedTime, and optional placeId without generating coordinates. Only use placeId from the verified list or null.`,
              },
              {
                role: 'user',
                content: `Original Day: ${JSON.stringify(existingDay)}\nChange: ${analysis.changeDescription}\nVerified Places:\n${formattedAttractions}`,
              },
            ]);
          } catch (secErr) {
            console.warn(`Secondary Groq step 2 error for day ${dayNumber}:`, secErr.message);
          }
        }
      }

      if (regeneratedDay && Array.isArray(regeneratedDay.activities) && regeneratedDay.activities.length > 0) {
        regeneratedDaysMap.set(dayNumber, {
          dayNumber,
          activities: regeneratedDay.activities,
          estimatedCostINR:
            regeneratedDay.estimatedCostINR != null
              ? regeneratedDay.estimatedCostINR
              : existingDay.estimatedCostINR,
          accommodationSuggestion:
            regeneratedDay.accommodationSuggestion || existingDay.accommodationSuggestion,
        });
      } else {
        // Fallback: apply edit note to activities as structured object
        const fallbackActivity = {
          title: `Updated: ${analysis.changeDescription}`,
          name: `Updated: ${analysis.changeDescription}`,
          description: `Experience the updated plan: ${analysis.changeDescription}`,
          suggestedTime: 'Morning',
          placeId: null,
          location: null,
        };
        const remainingActivities = (existingDay?.activities || []).slice(1).map((a) =>
          typeof a === 'string'
            ? {
                title: a,
                name: a,
                description: a,
                suggestedTime: null,
                placeId: null,
                location: null,
              }
            : a
        );
        regeneratedDaysMap.set(dayNumber, {
          dayNumber,
          activities: [fallbackActivity, ...remainingActivities],
          estimatedCostINR: existingDay.estimatedCostINR,
          accommodationSuggestion: existingDay.accommodationSuggestion,
        });
      }
    } else {
      // 3. Otherwise (some done, some not):
      const notDoneActs = acts.filter((a) => !(a && typeof a === 'object' && a.done === true));
      const completedSummary = doneActs
        .map(
          (a) =>
            `- "${a.title || a.name || ''}" (${getBucketFromSuggestedTime(a.suggestedTime)})`
        )
        .join('\n');

      if (apiKey) {
        try {
          const step2ModelWithDone = createGroqModel(
            DayPlanWithDoneSchema,
            process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
          );

          regeneratedDay = await step2ModelWithDone.invoke([
            {
              role: 'system',
              content: `You are an expert travel planner assistant.
Your task is to regenerate ONLY the remaining activities for Day ${dayNumber} of the itinerary to incorporate the user's requested changes.

IMPORTANT - PREVIOUSLY COMPLETED ACTIVITIES:
The user has already completed the following activities on Day ${dayNumber}:
${completedSummary}
- These completed activities MUST NOT be changed, replaced, or repeated in your output.
- Generate ONLY the remaining part of the day (the new or modified activities that are not already completed).
- If the user's request can only be satisfied by modifying, replacing, or removing an activity that has already been completed, set "blockedByDone": true.
- Provide the estimated cost of the WHOLE day in estimatedCostINR. If you cannot tell, keep the previous total cost (₹${existingDay?.estimatedCostINR || 0}).

Keep untouched parts of the remaining day coherent. Keep dayNumber exactly as ${dayNumber}.
Output strictly conforming to the schema with dayNumber, activities (array of objects with title, description, optional suggestedTime, and optional placeId), estimatedCostINR (number), accommodationSuggestion (string), and optional blockedByDone (boolean).

GROUNDED PLACES & VENUE RULES (STRICT):
- You are provided with a verified list of attractions and landmarks for this destination, each having an exact "placeId" and name.
- When an activity involves a specific venue or landmark, placeId MUST be the exact placeId from the provided list.
- NEVER invent or hallucinate a venue, attraction, or landmark name that isn't in the provided list.
- Generic activities (such as check-in, check-out, transit/travel, airport/station transfers, rest, relaxation, or meals without a named venue from the list) MUST have placeId: null.
- In activity descriptions, only name places, venues, and landmarks that exist in the provided verified list.
- Do NOT generate coordinates or location fields directly.`,
            },
            {
              role: 'user',
              content: `Trip Destination: ${itinerary.destination || 'N/A'}
Budget Tier: ${itinerary.budgetTier || 'mid'}
Interests: ${Array.isArray(itinerary.interests) ? itinerary.interests.join(', ') : 'sightseeing'}

Verified Attractions & Landmarks List (select placeId strictly from this list for venue/landmark activities):
${formattedAttractions}

Original Day ${dayNumber} Details:
- Already Completed Activities (DO NOT change or repeat):
${completedSummary}
- Other Activities:
${notDoneActs
  .map((a) =>
    typeof a === 'string'
      ? `  * ${a}`
      : `  * ${a.title || a.name || ''}${a.suggestedTime ? ` (${a.suggestedTime})` : ''}: ${a.description || ''}`
  )
  .join('\n') || '  (none)'}
- Previous Day Total Cost INR: ₹${existingDay?.estimatedCostINR || 0}
- Accommodation: ${existingDay?.accommodationSuggestion || 'N/A'}

Requested Change: ${analysis.changeDescription}
User's Message: "${editRequest.trim()}"

Please generate only the remaining activities for Day ${dayNumber}. If the change cannot be done without altering an already completed activity, set blockedByDone to true.`,
            },
          ]);
        } catch (err) {
          console.warn(`ChatGroq step 2 day ${dayNumber} (with done) error, trying secondary:`, err.message);
          try {
            const secondaryStep2WithDone = createGroqModel(DayPlanWithDoneSchema, 'openai/gpt-oss-20b');
            regeneratedDay = await secondaryStep2WithDone.invoke([
              {
                role: 'system',
                content: `Regenerate only the remaining activities for Day ${dayNumber} reflecting: ${analysis.changeDescription}. Already completed activities: ${completedSummary}. Do NOT repeat or modify completed activities. If the change requires modifying a completed activity, set blockedByDone: true. Provide whole day estimatedCostINR (keep previous ₹${existingDay?.estimatedCostINR || 0} if unsure). Output strictly conforming to schema. Only use placeId from verified list or null.`,
              },
              {
                role: 'user',
                content: `Original Day: ${JSON.stringify(existingDay)}\nChange: ${analysis.changeDescription}\nVerified Places:\n${formattedAttractions}`,
              },
            ]);
          } catch (secErr) {
            console.warn(`Secondary Groq step 2 error for day ${dayNumber}:`, secErr.message);
          }
        }
      }

      // If blockedByDone is true, change nothing, create no snapshot, and reply: "That's already marked done, so I left it alone."
      if (regeneratedDay?.blockedByDone === true) {
        return {
          success: false,
          reply: "That's already marked done, so I left it alone.",
          error: "That's already marked done, so I left it alone.",
        };
      }

      let rawNewActivities = [];
      if (regeneratedDay && Array.isArray(regeneratedDay.activities) && regeneratedDay.activities.length > 0) {
        rawNewActivities = regeneratedDay.activities;
      } else {
        // Fallback: apply edit note to activities as structured object
        const fallbackActivity = {
          title: `Updated: ${analysis.changeDescription}`,
          name: `Updated: ${analysis.changeDescription}`,
          description: `Experience the updated plan: ${analysis.changeDescription}`,
          suggestedTime: 'Morning',
          placeId: null,
          location: null,
        };
        const remainingNotDone = notDoneActs.slice(1).map((a) =>
          typeof a === 'string'
            ? {
                title: a,
                name: a,
                description: a,
                suggestedTime: null,
                placeId: null,
                location: null,
              }
            : a
        );
        rawNewActivities = [fallbackActivity, ...remainingNotDone];
      }

      // Ground new activities using attachGroundingLocations
      const tempDay = [{ dayNumber, activities: rawNewActivities }];
      const groundedTemp = attachGroundingLocations(tempDay, attractions);
      const groundedNewActivities = groundedTemp[0]?.activities || rawNewActivities;

      // Merge done activities and grounded new activities
      const mergedActivities = mergeDoneActivities(
        existingDay.activities,
        groundedNewActivities
      );

      regeneratedDaysMap.set(dayNumber, {
        dayNumber,
        activities: mergedActivities,
        estimatedCostINR:
          regeneratedDay?.estimatedCostINR != null
            ? regeneratedDay.estimatedCostINR
            : existingDay.estimatedCostINR,
        accommodationSuggestion:
          regeneratedDay?.accommodationSuggestion || existingDay.accommodationSuggestion,
      });

      preservedDayNumbers.add(dayNumber);
    }
  }

  // Post-processing: Attach grounding locations by placeId reference on regenerated day(s) that had NO done activities
  const daysWithoutDone = Array.from(regeneratedDaysMap.values()).filter(
    (d) => !preservedDayNumbers.has(d.dayNumber)
  );
  if (daysWithoutDone.length > 0) {
    const groundedRegeneratedDays = attachGroundingLocations(
      daysWithoutDone,
      attractions
    );
    groundedRegeneratedDays.forEach((gd) => {
      regeneratedDaysMap.set(gd.dayNumber, gd);
    });
  }

  // Capture snapshot of affected days prior to modifying them
  const previousDays = existingDays
    .filter((d) => analysis.targetDayNumbers.includes(d.dayNumber))
    .map((d) => (typeof d.toObject === 'function' ? d.toObject() : JSON.parse(JSON.stringify(d))));

  // Merge back into full days array, leaving untouched days exactly as they were
  const newDays = existingDays.map((originalDay) => {
    if (regeneratedDaysMap.has(originalDay.dayNumber)) {
      return regeneratedDaysMap.get(originalDay.dayNumber);
    }
    return originalDay;
  });

  // Atomic update: write new days AND push snapshot keeping only the last 10 entries
  const { updatedItinerary, editId } = await saveItineraryEditSnapshot({
    itineraryId: itinerary._id,
    userId,
    newDays,
    modifiedDayNumbers: analysis.targetDayNumbers,
    previousDays,
  });

  let reply = undefined;
  if (preservedDayNumbers.size > 0) {
    const baseReply = analysis.changeDescription
      ? `I have updated your itinerary: ${analysis.changeDescription.replace(/\.$/, '')}.`
      : 'I have updated your itinerary according to your request.';
    const preservedNotes = Array.from(preservedDayNumbers)
      .map((num) => `I updated the rest of Day ${num} and left the activities you already did as they are.`)
      .join(' ');
    reply = `${baseReply} ${preservedNotes}`;
  }

  return {
    success: true,
    itinerary: updatedItinerary || itinerary,
    modifiedDays: analysis.targetDayNumbers,
    changeDescription: analysis.changeDescription,
    editId,
    undoable: true,
    reply,
  };
};

/**
 * LangGraph-compatible agent node
 */
export const editNode = async (state) => {
  const itineraryId = state?.itineraryId;
  const userId = state?.userId;
  const editRequest = state?.editRequest || state?.message || state?.rawRequest;

  const result = await editItinerary({ itineraryId, userId, editRequest });

  return {
    ...state,
    editResult: result,
    itinerary: result.itinerary ? result.itinerary.days : state?.itinerary,
  };
};

export default editNode;

