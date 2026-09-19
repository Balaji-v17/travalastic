import 'dotenv/config';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';

// Zod schema for the extracted trip brief
export const TripBriefSchema = z.object({
  destination: z.string().describe('The primary destination or city of the trip'),
  startDate: z.string().describe('Trip start date in ISO format (YYYY-MM-DD)'),
  endDate: z.string().describe('Trip end date in ISO format (YYYY-MM-DD)'),
  budgetTier: z.enum(['budget', 'mid', 'luxury']).describe('Budget tier: budget, mid, or luxury'),
  interests: z.array(z.string()).describe('List of traveler interests, activities, or preferences'),
});

// Cerebras LLM configuration via ChatOpenAI
export const llm = new ChatOpenAI({
  modelName: 'llama3.1-70b',
  openAIApiKey: process.env.CEREBRAS_API_KEY,
  apiKey: process.env.CEREBRAS_API_KEY,
  configuration: {
    baseURL: 'https://api.cerebras.ai/v1',
  },
  temperature: 0.2,
});

// Helper to construct Cerebras model instance dynamically
export const createPlannerModel = (apiKey = process.env.CEREBRAS_API_KEY) => {
  return new ChatOpenAI({
    modelName: 'llama3.1-70b',
    openAIApiKey: apiKey,
    apiKey: apiKey,
    configuration: {
      baseURL: 'https://api.cerebras.ai/v1',
    },
    temperature: 0.2,
  });
};

export const model = llm;
export const structuredModel = llm.withStructuredOutput(TripBriefSchema);

export const extractTripBriefFallback = (rawRequest) => {
  const text = (rawRequest || '').toLowerCase();

  // Extract destination: check for "in <Destination>", "to <Destination>", etc.
  let destination = 'Goa';
  const destMatch = rawRequest.match(/\b(?:in|to|visit|for)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/);
  if (destMatch && destMatch[1]) {
    destination = destMatch[1].trim();
  } else {
    const capWords = rawRequest.match(/\b[A-Z][a-z]+/g);
    if (capWords && capWords.length > 0) {
      destination = capWords[0];
    }
  }

  // Extract duration: check for "X days"
  let durationDays = 5;
  const daysMatch = text.match(/(\d+)\s*days?/);
  if (daysMatch) {
    durationDays = parseInt(daysMatch[1], 10) || 5;
  }

  // Dates
  const now = new Date();
  let start = new Date(now);
  start.setDate(start.getDate() + 7);

  if (text.includes('december')) {
    const currentYear = now.getFullYear();
    const targetYear = now.getMonth() >= 11 && now.getDate() > 20 ? currentYear + 1 : currentYear;
    start = new Date(targetYear, 11, 1);
  } else if (text.includes('next month')) {
    start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const end = new Date(start);
  end.setDate(start.getDate() + durationDays);

  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  // Budget Tier
  let budgetTier = 'mid';
  if (text.includes('luxury') || text.includes('expensive') || text.includes('5-star')) {
    budgetTier = 'luxury';
  } else if (text.includes('budget') && !text.includes('mid-budget')) {
    budgetTier = 'budget';
  } else if (text.includes('mid')) {
    budgetTier = 'mid';
  }

  // Interests
  const candidateInterests = ['beaches', 'nightlife', 'culture', 'heritage', 'adventure', 'wildlife', 'food', 'nature', 'relaxation', 'shopping'];
  const foundInterests = candidateInterests.filter((kw) => text.includes(kw));
  const interests = foundInterests.length > 0 ? foundInterests : ['sightseeing', 'culture'];

  return {
    destination,
    startDate,
    endDate,
    budgetTier,
    interests,
  };
};

/**
 * Planner node function for LangGraph.
 * Accepts state with rawRequest, calls Cerebras with structured output, and returns extracted fields merged into state.
 * @param {Object} state - Graph state containing rawRequest
 * @returns {Promise<Object>} State merged with extracted trip brief fields
 */
export const plannerNode = async (state) => {
  const { rawRequest } = state || {};

  if (!rawRequest || typeof rawRequest !== 'string' || !rawRequest.trim()) {
    throw new Error('rawRequest string is required in state for plannerNode');
  }

  const prompt = [
    {
      role: 'system',
      content:
        'You are an expert travel planner assistant. Analyze the user trip request and extract the trip brief into the structured schema: destination (string), startDate (ISO 8601 format YYYY-MM-DD), endDate (ISO 8601 format YYYY-MM-DD), budgetTier ("budget", "mid", or "luxury"), and interests (array of strings). If dates or budget tier are not explicitly specified, infer realistic upcoming dates and reasonable defaults based on context.',
    },
    {
      role: 'user',
      content: rawRequest.trim(),
    },
  ];

  let extracted;
  const apiKey = process.env.CEREBRAS_API_KEY;

  if (apiKey) {
    try {
      const activeModel = createPlannerModel(apiKey).withStructuredOutput(TripBriefSchema);
      extracted = await activeModel.invoke(prompt);
    } catch (err) {
      console.warn('Cerebras planner error, trying secondary fallback:', err.message);
    }
  }

  if (!extracted && process.env.GROQ_API_KEY) {
    try {
      const groqModel = new ChatOpenAI({
        modelName: 'openai/gpt-oss-20b',
        apiKey: process.env.GROQ_API_KEY,
        configuration: {
          baseURL: 'https://api.groq.com/openai/v1',
        },
        temperature: 0.2,
      }).withStructuredOutput(TripBriefSchema);
      extracted = await groqModel.invoke(prompt);
    } catch (groqErr) {
      console.warn('Groq planner fallback error:', groqErr.message);
    }
  }

  if (!extracted) {
    extracted = extractTripBriefFallback(rawRequest);
  }

  return {
    ...state,
    ...extracted,
  };
};

export default plannerNode;
