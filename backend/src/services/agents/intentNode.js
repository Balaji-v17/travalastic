import 'dotenv/config';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';

/**
 * Strictly constrained intent enum:
 * - "edit_request": User wants to modify, add, delete, or rearrange activities, days, hotels, or constraints in their itinerary.
 * - "general_question": User is asking informational questions (weather, local customs, tips, packing advice, sightseeing details).
 * - "booking_question": User is inquiring about booking, purchasing tickets, reservation links, availability (flights, hotels, trains, cabs).
 */
export const IntentEnum = z.enum([
  'edit_request',
  'general_question',
  'booking_question',
]);

export const IntentClassificationSchema = z.object({
  intent: IntentEnum.describe(
    'Classify the user message into exactly one of: edit_request, general_question, booking_question'
  ),
});

/**
 * Factory helper for ChatGroq structured output model
 */
export const createIntentClassifier = (
  apiKey = process.env.GROQ_API_KEY,
  modelName = process.env.GROQ_INTENT_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
) => {
  return new ChatGroq({
    apiKey,
    model: modelName,
    temperature: 0,
  }).withStructuredOutput(IntentClassificationSchema);
};

/**
 * Fallback intent classifier using keyword heuristics
 * @param {string} message
 * @returns {'edit_request' | 'general_question' | 'booking_question'}
 */
export const classifyIntentFallback = (message = '') => {
  const text = message.toLowerCase().trim();

  // Planning keywords indicating intent to create or receive travel plans / itinerary / recommendations
  const planningKeywords = [
    'trip',
    'itinerary',
    'plan',
    'days trip',
    'day trip',
    'days in',
    'days for',
    'hidden gem',
    'hidden gems',
    'sights',
    'sightseeing',
    'attractions',
    'places to visit',
    'things to do',
    'recommend',
    'suggest',
    'guide',
    'explore',
    'travel ideas',
    'what to do',
  ];

  // Specific edit keywords for modifying existing itinerary days
  const editKeywords = [
    'modify',
    'swap',
    'reschedule',
    'instead of',
    'change day',
    'replace day',
    'delete day',
    'remove day',
    'drop day',
    'add a day',
    'day 1',
    'day 2',
    'day 3',
    'day 4',
    'day 5',
  ];

  // Words that indicate generating a new plan rather than editing an existing one
  const newPlanVerbs = [
    'provide',
    'create',
    'give me',
    'build',
    'make a',
    'suggest',
    'recommend',
  ];

  // Specific transactional booking phrases where user solely wants to execute a booking
  const soleBookingKeywords = [
    'book me',
    'reserve me',
    'buy ticket',
    'purchase ticket',
    'buy tickets',
    'book ticket',
    'book tickets',
    'book a room right now',
    'book hotel right now',
    'book flight',
    'book cab',
    'book train',
    'book bus',
    'booking.com',
    'duffel',
    'irctc',
    'redbus',
    'uber',
    'fare to',
    'ticket fare',
    'ticket price',
  ];

  const genericBookingKeywords = [
    'book',
    'reserve',
    'ticket',
    'reservation',
    'buy',
    'purchase',
    'fare',
  ];

  const hasPlanning = planningKeywords.some((kw) => text.includes(kw));
  const hasNewPlanVerb = newPlanVerbs.some((v) => text.includes(v));
  const hasEdit = editKeywords.some((kw) => text.includes(kw));

  // If query asks for planning/itinerary/recommendations (even if rooms/hotels/booking mentioned):
  if (hasPlanning || (hasNewPlanVerb && (text.includes('day') || text.includes('trip')))) {
    // If explicitly targeting existing numbered days, prioritize edit_request
    if (hasEdit && (text.includes('day 1') || text.includes('day 2') || text.includes('day 3') || text.includes('day 4') || text.includes('day 5'))) {
      return 'edit_request';
    }
    return 'general_question';
  }

  if (hasEdit) {
    return 'edit_request';
  }

  // Refined Deflection Rule:
  // Only classify as booking_question if the user's sole, direct intent is to perform an actual booking transaction
  if (
    soleBookingKeywords.some((kw) => text.includes(kw)) ||
    genericBookingKeywords.some((kw) => text.includes(kw))
  ) {
    return 'booking_question';
  }

  return 'general_question';
};

/**
 * Core function to classify user message intent.
 * Enforces the strict three-intent taxonomy via ChatGroq and Zod.
 *
 * @param {string} message - User query or chat input
 * @returns {Promise<{ intent: 'edit_request' | 'general_question' | 'booking_question' }>}
 */
export const classifyIntent = async (message) => {
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new Error('A non-empty message string is required for intent classification');
  }

  const prompt = [
    {
      role: 'system',
      content:
        `You are an expert intent classifier for Travalastic, an AI travel assistant.
Analyze the incoming user message and classify it into exactly one of three categories:

1. "edit_request": The user specifically requests modifying, adding, deleting, swapping, or rescheduling activities, days, or accommodations in an existing itinerary (e.g., "Change day 2 to Chapora Fort", "Remove the morning museum on day 3").

2. "general_question": The user asks for a trip plan, itinerary, recommendations, sights, attractions, hidden gems, weather, culture, travel advice, or general information.
   MULTI-INTENT PLANNING RULE:
   If the prompt asks for an itinerary, travel ideas, or recommendations ALONGSIDE hotel, room, or flight requests (e.g., "Provide a 2 days trip for Goa, search for budget rooms, and add a hidden gem", "Plan a weekend in Jaipur with budget stays"), you MUST classify this as "general_question" (or "edit_request" if explicitly modifying existing numbered days). Do NOT classify it as "booking_question" just because words like "rooms", "stays", "hotels", or "book" appear!

3. "booking_question": The user's SOLE, DIRECT intent is to perform an actual booking transaction or purchase (e.g., "Book me a room in Goa right now", "Find me flight tickets to Delhi", "How do I purchase a ticket?", "Reserve a cab for me"). Only use this if there is NO itinerary planning or recommendation request.

Choose strictly from these three options: edit_request, general_question, booking_question.`,
    },
    {
      role: 'user',
      content: message.trim(),
    },
  ];

  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    try {
      const classifier = createIntentClassifier(apiKey);
      const result = await classifier.invoke(prompt);
      if (result?.intent && IntentEnum.options.includes(result.intent)) {
        return { intent: result.intent };
      }
    } catch (err) {
      console.warn('ChatGroq intent classifier error, trying secondary model:', err.message);

      // Attempt secondary Groq model if primary was openai/gpt-oss-120b
      try {
        const secondary = createIntentClassifier(apiKey, 'openai/gpt-oss-20b');
        const secResult = await secondary.invoke(prompt);
        if (secResult?.intent && IntentEnum.options.includes(secResult.intent)) {
          return { intent: secResult.intent };
        }
      } catch (secErr) {
        console.warn('Secondary Groq intent model error:', secErr.message);
      }
    }
  }

  // Heuristic fallback
  const fallbackIntent = classifyIntentFallback(message);
  return { intent: fallbackIntent };
};

/**
 * LangGraph agent node wrapper for intent classification
 * @param {Object} state - Graph state containing message or rawRequest
 * @returns {Promise<Object>} Updated state with intent
 */
export const intentNode = async (state) => {
  const message = state?.message || state?.rawRequest || (Array.isArray(state?.messages) && state.messages[state.messages.length - 1]?.content) || '';
  const classification = await classifyIntent(message);
  return {
    ...state,
    ...classification,
  };
};

export default intentNode;

