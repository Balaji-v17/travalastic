import 'dotenv/config';
import { ChatGroq } from '@langchain/groq';
import Itinerary, { findUserItinerary } from '../../models/Itinerary.js';
import Expense from '../../models/Expense.js';
import Booking from '../../models/Booking.js';
import { checkInJourney } from './qaNode.js';
import { buildTripContext } from './tripContext.js';

/**
 * Handles grounded trip Q&A for the "trip_question" intent:
 * 1. Loads the itinerary fresh from DB on EVERY request using ownership check (no cached copy).
 * 2. If itinerary has no days, replies that it hasn't been generated and suggests generating it (no LLM call).
 * 3. Priority in-trip shortcut: if "what's next / today" matches in-journey criteria, answers directly (no LLM call).
 * 4. Loads expenses and linked flights fresh from the database.
 * 5. Builds compact whitelisted plain-text trip context (no sensitive passenger or payment data).
 * 6. Includes last 6 messages of THIS conversation.
 * 7. Prompts ChatGroq with strict grounding rules.
 *
 * @param {Object} params
 * @param {string} params.question - User question
 * @param {string|mongoose.Types.ObjectId} params.itineraryId - Itinerary ID
 * @param {string|mongoose.Types.ObjectId} params.userId - User ID for ownership check
 * @param {Array} [params.conversationMessages=[]] - Conversation message history
 * @param {Date|string} [params.currentDate=new Date()] - Date to evaluate as "today"
 * @returns {Promise<{ answer: string, inJourney?: boolean, grounded: boolean, dayNumber?: number }>}
 */
export async function answerTripQuestion({
  question,
  itineraryId,
  userId,
  conversationMessages = [],
  currentDate = new Date(),
}) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new Error('A non-empty question string is required');
  }

  // 1. Fresh reload from database on EVERY request with ownership check (no cached copy)
  const itinerary = await findUserItinerary(itineraryId, userId);
  if (!itinerary) {
    const error = new Error('Itinerary not found');
    error.status = 404;
    throw error;
  }

  // 2. If the itinerary has no days yet, reply that it hasn't been generated (no LLM call)
  if (!Array.isArray(itinerary.days) || itinerary.days.length === 0) {
    return {
      answer:
        "Your itinerary hasn't been generated yet. Please generate an itinerary first to view your daily schedule and trip details.",
      grounded: false,
    };
  }

  // 3. Existing "what's next / today" in-trip shortcut keeps priority (no LLM call)
  const inJourneyResult = checkInJourney(itinerary, question, currentDate);
  if (inJourneyResult) {
    return inJourneyResult;
  }

  // 4. Fetch expenses and linked flights fresh
  const [expenses, flightBookings] = await Promise.all([
    Expense.find({ itineraryId: itinerary._id }).sort({ createdAt: -1 }),
    Booking.find({ itineraryId: itinerary._id, type: 'flight' }).sort({
      departureTime: 1,
      createdAt: -1,
    }),
  ]);

  // 5. Build compact whitelisted context
  const tripContext = buildTripContext(itinerary, expenses, flightBookings);

  // 6. Include the last 6 messages of THIS conversation
  const recentMessages = (conversationMessages || []).slice(-6).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : String(m.content || ''),
  }));

  // Ensure current question is at the end of the history
  const trimmedQ = question.trim();
  if (
    recentMessages.length === 0 ||
    recentMessages[recentMessages.length - 1].content !== trimmedQ
  ) {
    recentMessages.push({ role: 'user', content: trimmedQ });
  }

  // 7. System prompt enforcing strict grounding rules
  const systemPrompt = `You are Travalastic's trip assistant. You answer questions strictly grounded in the user's saved trip data.

TRIP DATA:
"""
${tripContext}
"""

STRICT INSTRUCTIONS:
1. Answer ONLY from the provided trip data above.
2. If something is not in the data, state plainly that it is not available (consult the NOT AVAILABLE list) and ask at most one short follow-up question if needed.
3. NEVER invent or assume hotels, prices, opening hours, or travel times.
4. Keep AI estimates (e.g. estimated cost of days and total budget) and logged actual expenses (actual expenses logged by the user) completely separate. Never confuse them.
5. For feasibility questions (e.g. whether an activity fits into a day):
   - Reason ONLY from activities, time buckets, and straight-line distance when coordinates are known for both locations.
   - Say clearly that you cannot verify drive times or traffic conditions.
6. NEVER claim to have changed the itinerary (editing is handled by the edit flow).
7. Be concise, direct, and helpful.
8. FORMATTING RULE: STRICTLY AVOID Markdown tables (| Col 1 | Col 2 |). Tables clip awkwardly in mobile chat bubbles. Use plain text, bullet points, or bold text.`;

  const apiKey = process.env.GROQ_API_KEY;
  let replyText = null;

  if (apiKey) {
    const groqMessages = [{ role: 'system', content: systemPrompt }, ...recentMessages];

    try {
      const chat = new ChatGroq({
        apiKey,
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        temperature: 0.2,
      });
      const res = await chat.invoke(groqMessages);
      replyText = typeof res.content === 'string' ? res.content : res.content?.[0]?.text;
    } catch (err) {
      console.warn('ChatGroq trip QA primary model error, trying secondary:', err.message);
      try {
        const fallbackChat = new ChatGroq({
          apiKey,
          model: 'openai/gpt-oss-20b',
          temperature: 0.2,
        });
        const res = await fallbackChat.invoke(groqMessages);
        replyText = typeof res.content === 'string' ? res.content : res.content?.[0]?.text;
      } catch (secErr) {
        console.warn('ChatGroq trip QA secondary model error:', secErr.message);
      }
    }
  }

  if (!replyText) {
    // Deterministic fallback for offline testing or API unavailability
    replyText = `Based on your saved trip to ${itinerary.destination || 'your destination'}, you have ${itinerary.days.length} days planned. Please let me know what specific day or detail you would like to know about.`;
  }

  return {
    answer: replyText.trim(),
    grounded: true,
  };
}

/**
 * LangGraph agent node wrapper for tripQaNode
 */
export async function tripQaNode(state) {
  const question =
    state?.question ||
    state?.message ||
    state?.rawRequest ||
    (Array.isArray(state?.messages) && state.messages[state.messages.length - 1]?.content) ||
    '';
  const itineraryId = state?.itineraryId || state?.itinerary?._id;
  const userId = state?.userId;
  const conversationMessages = state?.messages || [];
  const currentDate = state?.currentDate;

  const result = await answerTripQuestion({
    question,
    itineraryId,
    userId,
    conversationMessages,
    currentDate,
  });

  return {
    ...state,
    tripQaResult: result,
    answer: result.answer,
  };
}

export default tripQaNode;

