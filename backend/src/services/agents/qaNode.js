import 'dotenv/config';
import { ChatGroq } from '@langchain/groq';
import embedText from '../embeddingService.js';
import DestinationContent from '../../models/DestinationContent.js';

/**
 * Similarity threshold for grounding Q&A with DestinationContent.
 * Scores >= 0.86 use the retrieved blurb as context.
 * Scores < 0.86 discard the retrieved content to avoid forcing irrelevant context.
 */
export const SIMILARITY_THRESHOLD = 0.86;

/**
 * Checks for in-journey status and answers schedule questions directly
 * from the stored itinerary without LLM or vector search.
 *
 * @param {Object} itinerary - Itinerary document with startDate, endDate, and days
 * @param {string} question - User question
 * @param {Date|string} [currentDate=new Date()] - Date to evaluate as "today"
 * @returns {{ answer: string, inJourney: boolean, dayNumber: number, grounded: boolean } | null}
 */
export const checkInJourney = (itinerary, question, currentDate = new Date()) => {
  if (!itinerary || !itinerary.startDate || !itinerary.endDate || !Array.isArray(itinerary.days)) {
    return null;
  }

  const todayStr =
    typeof currentDate === 'string'
      ? currentDate.slice(0, 10)
      : currentDate.toISOString().slice(0, 10);

  const { startDate, endDate } = itinerary;

  // Verify today falls between startDate and endDate (inclusive)
  if (todayStr < startDate || todayStr > endDate) {
    return null;
  }

  // Check for simple in-journey cues: "today", "next", "now", "schedule" (case-insensitive)
  const q = (question || '').toLowerCase();
  const cues = ['today', 'next', 'now', 'schedule'];
  const hasCue = cues.some((cue) => new RegExp(`\\b${cue}\\b`, 'i').test(q));

  if (!hasCue) {
    return null;
  }

  // Calculate corresponding 1-indexed day number
  const start = new Date(startDate);
  const current = new Date(todayStr);
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const dayNumber = diffDays + 1;

  const dayPlan = itinerary.days.find((d) => d.dayNumber === dayNumber);
  if (!dayPlan) {
    return null;
  }

  const activitiesFormatted =
    Array.isArray(dayPlan.activities) && dayPlan.activities.length > 0
      ? dayPlan.activities.map((a) => `• ${a}`).join('\n')
      : 'No specific activities scheduled.';

  let answer = `Today (Day ${dayNumber}) you have:\n${activitiesFormatted}`;
  if (dayPlan.accommodationSuggestion) {
    answer += `\nStay: ${dayPlan.accommodationSuggestion}`;
  }

  return {
    answer,
    inJourney: true,
    dayNumber,
    grounded: false,
  };
};

/**
 * Executes the general RAG Q&A path:
 * 1. Embeds question using embeddingService (768 dimensions)
 * 2. Runs $vectorSearch against DestinationContent
 * 3. Compares top similarity score against threshold (0.86)
 * 4. Grounds ChatGroq if above threshold, or prompts from general knowledge if below.
 *
 * @param {string} question - User question
 * @param {Object} [itinerary={}] - Optional itinerary context
 * @returns {Promise<{ answer: string, inJourney: boolean, grounded: boolean, similarityScore: number|null, groundingContext: string|null }>}
 */
export const answerWithRAG = async (question, itinerary = {}) => {
  const apiKey = process.env.GROQ_API_KEY;
  let groundingContext = null;
  let topScore = null;

  try {
    const embedding = await embedText(question);

    const matches = await DestinationContent.aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: 15,
          limit: 1,
        },
      },
      {
        $project: {
          _id: 0,
          text: 1,
          tags: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);

    if (Array.isArray(matches) && matches.length > 0 && matches[0].score != null) {
      topScore = matches[0].score;
      if (topScore >= SIMILARITY_THRESHOLD) {
        groundingContext = matches[0].text;
      }
    }
  } catch (err) {
    console.warn('Vector search error in qaNode:', err.message);
  }

  // Formulate ChatGroq prompt
  let systemPrompt;
  if (groundingContext) {
    systemPrompt = `You are an expert travel assistant for Travalastic. Answer the user's travel question accurately, helpfully, and concisely.
Use the following relevant destination content to ground your answer:
"""
${groundingContext}
"""
Incorporate the details naturally into your response.`;
  } else {
    // Below threshold: skip retrieved content entirely and answer from general knowledge
    systemPrompt = `You are an expert travel assistant for Travalastic. Answer the user's travel question accurately, helpfully, and concisely using your general travel knowledge.`;
  }

  const destinationHint = itinerary?.destination ? `Trip Destination: ${itinerary.destination}\n` : '';
  const userContent = `${destinationHint}Question: ${question.trim()}`;

  const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  let responseText;

  if (apiKey) {
    try {
      const chat = new ChatGroq({
        apiKey,
        model: modelName,
        temperature: 0.3,
      });

      const res = await chat.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ]);
      responseText = typeof res.content === 'string' ? res.content : res.content?.[0]?.text;
    } catch (err) {
      console.warn('ChatGroq QA primary model error, attempting secondary:', err.message);
      try {
        const fallbackChat = new ChatGroq({
          apiKey,
          model: 'openai/gpt-oss-20b',
          temperature: 0.3,
        });
        const res = await fallbackChat.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ]);
        responseText = typeof res.content === 'string' ? res.content : res.content?.[0]?.text;
      } catch (secErr) {
        console.warn('ChatGroq QA secondary model error:', secErr.message);
      }
    }
  }

  if (!responseText) {
    if (groundingContext) {
      responseText = `Based on destination highlights: ${groundingContext}`;
    } else {
      responseText = `Here is information regarding your query about ${question}: Safe travels and enjoy your journey!`;
    }
  }

  return {
    answer: responseText.trim(),
    inJourney: false,
    grounded: !!groundingContext,
    similarityScore: topScore,
    groundingContext: groundingContext || null,
  };
};

/**
 * Main Q&A handler:
 * First attempts the in-journey direct schedule lookup.
 * If in-journey criteria are not met, executes the threshold-gated RAG pipeline.
 *
 * @param {Object} params
 * @param {string} params.question - The user's input question
 * @param {Object} [params.itinerary] - Active itinerary context
 * @param {Date|string} [params.currentDate] - Date to evaluate as "today"
 * @returns {Promise<{ answer: string, inJourney: boolean, grounded: boolean, dayNumber?: number, similarityScore?: number|null }>}
 */
export const answerQuestion = async ({ question, itinerary, currentDate = new Date() }) => {
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new Error('A non-empty question string is required');
  }

  // In-journey check first: pure lookup, no LLM or vector search
  const inJourneyResult = checkInJourney(itinerary, question, currentDate);
  if (inJourneyResult) {
    return inJourneyResult;
  }

  // Otherwise, run general RAG path
  return answerWithRAG(question, itinerary);
};

/**
 * LangGraph agent node wrapper
 */
export const qaNode = async (state) => {
  const question = state?.question || state?.message || state?.rawRequest || '';
  const itinerary = state?.itineraryDoc || state?.itinerary;
  const currentDate = state?.currentDate;

  const result = await answerQuestion({ question, itinerary, currentDate });

  return {
    ...state,
    qaResult: result,
    answer: result.answer,
  };
};

export default qaNode;

