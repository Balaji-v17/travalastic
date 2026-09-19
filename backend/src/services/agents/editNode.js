import 'dotenv/config';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';
import { DayPlanSchema } from './composerNode.js';
import { findUserItinerary } from '../../models/Itinerary.js';

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
    .map(
      (d) =>
        `Day ${d.dayNumber}: Activities: [${(d.activities || []).join('; ')}], Cost: ₹${d.estimatedCostINR || 0}, Stay: ${d.accommodationSuggestion || 'N/A'}`
    )
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

  // Step 2: Regenerate each affected day using DayPlanSchema from composerNode
  const regeneratedDaysMap = new Map();

  for (const dayNumber of analysis.targetDayNumbers) {
    const existingDay = existingDays.find((d) => d.dayNumber === dayNumber);
    let regeneratedDay;

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
4. Output strictly conforming to the DayPlanSchema with dayNumber, activities (array of strings), estimatedCostINR (number), and accommodationSuggestion (string).`,
          },
          {
            role: 'user',
            content: `Trip Destination: ${itinerary.destination || 'N/A'}
Budget Tier: ${itinerary.budgetTier || 'mid'}
Interests: ${Array.isArray(itinerary.interests) ? itinerary.interests.join(', ') : 'sightseeing'}

Original Day ${dayNumber} Details:
- Activities:
${(existingDay?.activities || []).map((a) => `  * ${a}`).join('\n') || '  (none)'}
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
              content: `Regenerate Day ${dayNumber} reflecting the requested change: ${analysis.changeDescription}`,
            },
            {
              role: 'user',
              content: `Original Day: ${JSON.stringify(existingDay)}\nChange: ${analysis.changeDescription}`,
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
      // Fallback: apply edit note to activities
      regeneratedDaysMap.set(dayNumber, {
        dayNumber,
        activities: [
          `Updated: ${analysis.changeDescription}`,
          ...(existingDay.activities || []).slice(1),
        ],
        estimatedCostINR: existingDay.estimatedCostINR,
        accommodationSuggestion: existingDay.accommodationSuggestion,
      });
    }
  }

  // Merge back into full days array, leaving untouched days exactly as they were
  itinerary.days = existingDays.map((originalDay) => {
    if (regeneratedDaysMap.has(originalDay.dayNumber)) {
      return regeneratedDaysMap.get(originalDay.dayNumber);
    }
    return originalDay;
  });

  await itinerary.save();

  return {
    success: true,
    itinerary,
    modifiedDays: analysis.targetDayNumbers,
    changeDescription: analysis.changeDescription,
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

