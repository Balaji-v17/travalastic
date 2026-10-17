import 'dotenv/config';
import { z } from 'zod';
import { ChatGroq } from '@langchain/groq';

/**
 * Strictly constrained intent enum:
 * - "edit_request": User wants to modify, add, delete, or rearrange activities, days, hotels, or constraints in their itinerary (e.g. "make day 2 cheaper", "change day 2 to Baga").
 * - "trip_question": User asks questions answerable from the saved itinerary (what's planned, which day has X, costs and estimates, whether something fits into a day's schedule).
 * - "general_question": User asks travel questions in general (destinations, food, packing, visas, transport, safety, travel advice).
 * - "booking_question": User is inquiring about performing an actual booking transaction (flights, hotels, trains, cabs).
 * - "off_topic": Questions with no connection to travel or this trip (trivia, coding help, math, personal advice, jokes).
 */
export const IntentEnum = z.enum([
  'edit_request',
  'trip_question',
  'general_question',
  'booking_question',
  'off_topic',
]);

export const IntentClassificationSchema = z.object({
  intent: IntentEnum.describe(
    'Classify the user message into exactly one of: edit_request, trip_question, general_question, booking_question, off_topic'
  ),
});

/**
 * Configuration constant for off-topic deflection message.
 * Set to false for now; will be switched on when the general Travel Assistant is available.
 */
export const GENERAL_ASSISTANT_AVAILABLE = true;

export const OFF_TOPIC_MESSAGES = {
  unavailable:
    "I focus on your trip and travel plans, so I can't help with that. If it relates to your trip, tell me how.",
  available:
    "I focus on your trip, so I can't help with that here. For general questions, try the Travel Assistant.",
};

/**
 * Selects the static reply for off_topic queries based on GENERAL_ASSISTANT_AVAILABLE.
 * @param {boolean} [isAvailable=GENERAL_ASSISTANT_AVAILABLE]
 * @returns {string}
 */
export function getOffTopicMessage(isAvailable = GENERAL_ASSISTANT_AVAILABLE) {
  return isAvailable ? OFF_TOPIC_MESSAGES.available : OFF_TOPIC_MESSAGES.unavailable;
}

/**
 * Pure function mapping intent to handler and answerType.
 * answerType must be one of: trip, general, edit, booking, in_journey, redirect.
 *
 * @param {string} intent
 * @returns {{ handler: string, answerType: 'trip' | 'general' | 'edit' | 'booking' | 'in_journey' | 'redirect' }}
 */
export function routeIntent(intent) {
  switch (intent) {
    case 'edit_request':
    case 'edit':
      return { handler: 'edit', answerType: 'edit' };
    case 'booking_question':
    case 'booking':
      return { handler: 'booking', answerType: 'booking' };
    case 'trip_question':
    case 'trip':
      return { handler: 'trip', answerType: 'trip' };
    case 'in_journey':
      return { handler: 'in_journey', answerType: 'in_journey' };
    case 'off_topic':
    case 'redirect':
      return { handler: 'redirect', answerType: 'redirect' };
    case 'general_question':
    case 'general':
    default:
      return { handler: 'general', answerType: 'general' };
  }
}

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
 * Fallback intent classifier using heuristic patterns
 *
 * Rules:
 * - A question about travel in general (destinations, food, packing, visas, transport, safety) is general_question, NOT off_topic.
 * - When unsure between off_topic and general_question, choose general_question.
 * - When unsure between trip_question and general_question, choose trip_question.
 *
 * @param {string} message
 * @returns {'edit_request' | 'trip_question' | 'general_question' | 'booking_question' | 'off_topic'}
 */
export const classifyIntentFallback = (message = '') => {
  const text = message.toLowerCase().trim();
  if (!text) return 'general_question';

  // 1. Specific edit commands modifying existing itinerary days
  const isEditCommand =
    /\b(?:make\s+(?:day\s*\d+|it|the\s+trip)\s+(?:cheaper|budget|less|more|affordable|relaxing|hectic))\b/i.test(text) ||
    /\b(?:change|replace|swap|reschedule|modify|update|shift|cancel)\s+day\s*\d+\b/i.test(text) ||
    /\b(?:remove|delete|drop|cancel)\s+.*\s+(?:from|on|in)\s+day\s*\d+\b/i.test(text) ||
    /\b(?:add|insert)\s+.*\s+(?:to|in|into|on)\s+day\s*\d+\b/i.test(text) ||
    /\b(?:swap|switch)\s+day\s*\d+\s+and\s+day\s*\d+\b/i.test(text) ||
    /\b(?:reschedule\s+day|change\s+day|replace\s+day|delete\s+day|remove\s+day|drop\s+day|add\s+a\s+day)\b/i.test(text) ||
    /\binstead\s+of\b/i.test(text);

  if (isEditCommand) {
    return 'edit_request';
  }

  // 2. Feasibility & schedule inquiry patterns (trip_question)
  const isFeasibilityQuestion =
    /\b(?:can\s+(?:i|we)\s+fit|will\s+.*\s+fit|do\s+(?:i|we)\s+have\s+time|is\s+there\s+(?:enough\s+)?time|is\s+.*\s+feasible)\b/i.test(text);

  const isCostOrExpenseQuestion =
    /\b(?:how\s+much\s+(?:will|does|did|is|for)|what\s+(?:is|are)\s+(?:the\s+)?(?:estimated\s+)?cost|cost\s+of\s+day|total\s+cost|logged\s+expenses|my\s+expenses|spend\s+so\s+far)\b/i.test(text);

  const isScheduleOrPlanQuestion =
    /\b(?:what\s+(?:am\s+i|are\s+we)\s+doing|what\s+(?:is|are)\s+(?:the\s+)?(?:plan|plans|activities|itinerary|schedule)|what\s+do\s+(?:i|we)\s+have|which\s+day\s+(?:is|has|do|are)|where\s+(?:am\s+i|are\s+we)\s+(?:going|staying)|show\s+(?:me\s+)?day\s*\d+)\b/i.test(text) ||
    /\bwhat(?:'s|s|\s+is)\s+(?:planned|on|scheduled)\b/i.test(text);

  const isFlightOrBookingInquiry =
    /\b(?:what\s+(?:are|is)\s+(?:my\s+)?flights?|flight\s+status|when\s+is\s+my\s+flight|what\s+bookings?\s+do\s+i\s+have|my\s+flights?)\b/i.test(text);

  const referencesNumberedDay = /\bday\s*\d+\b/i.test(text);

  if (
    isFeasibilityQuestion ||
    isCostOrExpenseQuestion ||
    isScheduleOrPlanQuestion ||
    isFlightOrBookingInquiry
  ) {
    return 'trip_question';
  }

  if (
    referencesNumberedDay &&
    (text.includes('?') || /\b(?:what|how|which|where|when|can|is|tell\s+me)\b/i.test(text))
  ) {
    return 'trip_question';
  }

  // 3. Specific transactional booking phrases where user solely wants to execute a booking
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

  if (
    soleBookingKeywords.some((kw) => text.includes(kw)) ||
    genericBookingKeywords.some((kw) => text.includes(kw))
  ) {
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
    const hasPlanning = planningKeywords.some((kw) => text.includes(kw));
    if (hasPlanning) {
      return 'general_question';
    }
    return 'booking_question';
  }

  // 4. General travel indicators (destinations, food, packing, visas, transport, safety)
  // Rule: A question about travel in general is general_question, NOT off_topic.
  const hasPackingIndicator = /\b(?:pack|packing|clothes|luggage|baggage)\b/i.test(text);
  const hasFoodIndicator = /\b(?:food|eat|eating|restaurants?|cuisine|dishes|delicac(?:y|ies)|specialt(?:y|ies))\b/i.test(text);
  const hasSafetyOrWeather = /\b(?:safe|safety|danger|crime|weather|climate|season|temperature|rain|monsoon)\b/i.test(text);
  const hasTravelTerms = /\b(?:travel|visit|visiting|tourism|tourist|visa|visas|passport|flight|train|bus|cab|hotel|hostel|stay|explore|vacation|holiday|attractions?|places?|sights?|sightseeing|hidden\s+gems?)\b/i.test(text);

  if (hasPackingIndicator || hasFoodIndicator || hasSafetyOrWeather || hasTravelTerms) {
    return 'general_question';
  }

  // 5. Off-topic indicators (coding, trivia, math, jokes, personal advice)
  const isCoding = /\b(?:python|javascript|typescript|java|c\+\+|coding|code|script|debug|function|algorithm|html|css|sql|react|github)\b/i.test(text);
  const isJoke = /\b(?:tell\s+me\s+a\s+joke|joke|funny|riddle)\b/i.test(text);
  const isMath = /\b(?:math|calculate|\d+\s*[\+\-\*\/\^]\s*\d+)\b/i.test(text);
  const isPersonalAdvice = /\b(?:relationship|dating|girlfriend|boyfriend|break\s+up|life\s+advice|marry)\b/i.test(text);
  const isTriviaOrQuiz = /\b(?:what(?:'s|s|\s+is)\s+the\s+capital\s+of|who\s+(?:is|was|invented|discovered)|when\s+was\s+.*\s+(?:born|invented|discovered))\b/i.test(text);

  if (isCoding || isJoke || isMath || isPersonalAdvice || isTriviaOrQuiz) {
    return 'off_topic';
  }

  // Fallback: When unsure between off_topic and general_question, choose general_question.
  return 'general_question';
};

/**
 * Core function to classify user message intent.
 * Enforces the strict five-intent taxonomy via ChatGroq and Zod.
 *
 * @param {string} message - User query or chat input
 * @returns {Promise<{ intent: 'edit_request' | 'trip_question' | 'general_question' | 'booking_question' | 'off_topic' }>}
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
Analyze the incoming user message and classify it into exactly one of five categories:

1. "edit_request": The user specifically requests modifying, adding, deleting, swapping, rescheduling, or adjusting activities, days, costs, or accommodations in an existing itinerary (e.g., "Change day 2 to Chapora Fort", "Remove the morning museum on day 3", "Make day 2 cheaper", "Swap day 1 and 2", "Add scuba diving on day 1").

2. "trip_question": The user asks questions answerable from their saved itinerary (what is planned, which day has an activity or place, costs and estimates, or whether an activity fits into a day's schedule). Examples: "what am I doing on day 2", "how much will day 2 cost", "can I fit Jog Falls on day 1", "which day is the beach visit", "what is my flight status", "what are my total expenses".
   PRIORITY RULE: When unsure between trip_question and general_question, choose trip_question.

3. "general_question": The user asks a question about travel in general (destinations, recommendations, food, packing, visas, transport, safety, weather, culture, travel advice, or planning a new trip from scratch).
   Examples: "what should I pack", "best food in Mysore", "is it safe to travel to Kashmir in November", "best time of year to visit Goa", "plan a 3 days trip to Jaipur".
   PRIORITY RULE: A question about travel in general (destinations, food, packing, visas, transport, safety) is general_question, NOT off_topic. When unsure between off_topic and general_question, choose general_question.
   MULTI-INTENT PLANNING RULE:
   If the prompt asks for an itinerary, travel ideas, or recommendations ALONGSIDE hotel, room, or flight requests (e.g., "Provide a 2 days trip for Goa, search for budget rooms, and add a hidden gem", "Plan a weekend in Jaipur with budget stays"), you MUST classify this as "general_question" (or "edit_request" if explicitly modifying existing numbered days). Do NOT classify it as "booking_question" just because words like "rooms", "stays", "hotels", or "book" appear!

4. "booking_question": The user's SOLE, DIRECT intent is to perform an actual booking transaction or purchase (e.g., "Book me a room in Goa right now", "Find me flight tickets to Delhi", "How do I purchase a ticket?", "Reserve a cab for me"). Only use this if there is NO itinerary planning, editing, or trip question.

5. "off_topic": The user asks questions with NO connection to travel or this trip (trivia, coding help, math, personal advice, jokes).
   Examples: "what's the capital of France", "write me a python script", "tell me a joke", "what is 2 + 2", "should I break up with my girlfriend".

Choose strictly from these five options: edit_request, trip_question, general_question, booking_question, off_topic.`,
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
  const message =
    state?.message ||
    state?.rawRequest ||
    (Array.isArray(state?.messages) && state.messages[state.messages.length - 1]?.content) ||
    '';
  const classification = await classifyIntent(message);
  return {
    ...state,
    ...classification,
  };
};

export default intentNode;
