import { GoogleGenAI } from '@google/genai';

// In-memory cache for text embeddings (TTL: 10 minutes)
const embeddingCache = new Map();
const EMBEDDING_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Generates an embedding vector for the provided text using Gemini.
 * Caches embeddings in-memory for 10 minutes to avoid redundant API calls.
 * @param {string} text - The input text to embed
 * @returns {Promise<number[]>} - 768-dimensional embedding array
 */
const embedText = async (text) => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Text is required for embedding generation');
  }

  const cleanText = text.trim();
  const cached = embeddingCache.get(cleanText);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.embedding;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: cleanText,
    config: {
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: 768,
    },
  });

  const values =
    response.embeddings?.[0]?.values ||
    response.embedding?.values ||
    response.embedding ||
    response.values;

  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Failed to extract embedding values from Gemini response');
  }

  embeddingCache.set(cleanText, {
    embedding: values,
    expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
  });

  return values;
};

export default embedText;
export { embedText, embeddingCache };
