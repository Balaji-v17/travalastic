import 'dotenv/config';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';

/**
 * Zod schema for each day in the itinerary.
 * Each day contains dayNumber, activities, estimatedCostINR, and accommodationSuggestion.
 */
export const DayPlanSchema = z.object({
  dayNumber: z.number().describe('The day number of the trip (e.g. 1, 2, etc.)'),
  activities: z.array(z.string()).describe('Array of activities planned for this day'),
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

  for (let i = 1; i <= diffDays; i++) {
    const attraction = attractions[i - 1]?.name || `${destination} Central Area`;
    const blurb = personalizedContent[i - 1]?.text || `Enjoy local experiences tailored to ${interests}.`;
    const eveningActivity = isNightlife
      ? `Evening: Experience the vibrant nightlife at local bars, cocktail lounges, and night entertainment districts in ${destination}.`
      : `Evening: Dinner at a popular local restaurant enjoying the atmosphere in ${destination}.`;

    days.push({
      dayNumber: i,
      activities: [
        `Morning: Explore ${attraction} and discover local sights.`,
        `Afternoon: ${blurb.slice(0, 120)}...`,
        eveningActivity,
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

  const systemPrompt = `You are an expert travel planner assistant.
Your task is to create a coherent, realistic day-by-day travel plan based on the provided trip context.

You MUST strictly enforce the following rules:

1. STRICT INTEREST ADHERENCE:
   - Prioritize the user's explicit interests (${interestsList}).
   - At least 60-70% of suggested activities MUST directly match these interests. If "nightlife" is selected, evenings MUST feature bars, clubs, izakayas, night markets, or evening entertainment districts—never quiet park walks or daytime tea ceremonies unless requested.

CRITICAL BUDGET RULES:
- You have a strict budget of ${budget} INR total.
- This means you MUST allocate approximately ${perDayBudget} INR per day.
- Do NOT output a low default budget like 1500 INR. 
- The 'estimatedCostINR' for EACH day MUST be between ${Math.round(perDayBudget * 0.8)} INR and ${Math.round(perDayBudget * 1.2)} INR.
- Suggest hotels and activities that actually cost this amount (e.g., boutique hotels, upscale dining, premium club entry).

3. CONTEXT INTEGRATION & SCHEMA:
   - Incorporate the destination (${state?.destination || 'N/A'}), weather forecast, attractions, and personalized content blurbs into the daily schedule.
   - Output strictly structured output conforming to the itinerary schema with dayNumber, activities (array of strings), estimatedCostINR (number), and accommodationSuggestion (string) for each day.`;

  const userPrompt = `Here is the gathered trip context and research data:
- Destination: ${state?.destination || 'N/A'}
- Dates: ${state?.startDate || 'N/A'} to ${state?.endDate || 'N/A'} (${tripDays} days)
- Budget Tier: ${state?.budgetTier || 'mid'}
- Total Budget Estimate: ${budget} INR (~${perDayBudget} INR/day)
- Interests: ${interestsList}
- Weather Forecast: ${JSON.stringify(state?.weather || {})}
- Attractions: ${JSON.stringify(state?.attractions || [])}
- Accommodation Options: ${JSON.stringify(state?.accommodationOptions || [])}
- Personalized Content Blurbs: ${JSON.stringify(state?.personalizedContent || [])}
- Raw Request: "${state?.rawRequest || ''}"

Please create a detailed, day-by-day itinerary that strictly follows the rules above, focuses 60-70% on ${interestsList}, and accurately targets between ${Math.round(perDayBudget * 0.8)} INR and ${Math.round(perDayBudget * 1.2)} INR for each day's estimatedCostINR.`;

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
      return {
        itinerary: days,
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
          return {
            itinerary: days,
          };
        }
      } catch (secErr) {
        console.warn('Secondary Groq model error:', secErr.message);
      }
    }

    const fallbackDays = buildFallbackItineraryDays(state);
    return {
      itinerary: fallbackDays,
    };
  }
};

export default composerNode;
