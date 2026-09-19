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
  const text = message.toLowerCase();

  const editKeywords = [
    'change',
    'modify',
    'swap',
    'remove',
    'delete',
    'add',
    'replace',
    'switch',
    'update',
    'drop',
    'reschedule',
    'day 1',
    'day 2',
    'day 3',
    'day 4',
    'day 5',
    'instead of',
  ];

  const bookingKeywords = [
    'book',
    'reserve',
    'ticket',
    'reservation',
    'buy',
    'purchase',
    'uber',
    'irctc',
    'redbus',
    'booking.com',
    'duffel',
    'fare',
  ];

  if (editKeywords.some((kw) => text.includes(kw))) {
    return 'edit_request';
  }

  if (bookingKeywords.some((kw) => text.includes(kw))) {
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
        'You are an expert intent classifier for a travel itinerary assistant. Analyze the incoming user message and classify it into exactly one of three categories: "edit_request" (wants to change, add, delete, reschedule, or swap itinerary items), "general_question" (asking about weather, culture, travel advice, suggestions, or general travel info), or "booking_question" (asking how to book flights, hotels, trains, buses, cabs, or check ticket availability). Choose strictly from these three options.',
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

