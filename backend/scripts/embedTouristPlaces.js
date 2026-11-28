import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import 'dotenv/config';

import embedText from '../src/services/embeddingService.js';
import TouristPlace from '../src/models/TouristPlace.js';
import { EMBED_UNEMBEDDED_QUERY, buildDescriptiveText } from '../src/utils/placeEmbedding.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { buildDescriptiveText, EMBED_UNEMBEDDED_QUERY };

/**
 * Helper to call embedText with retry and exponential backoff for rate limits.
 */
async function embedWithRetry(text, embedFn = embedText, retries = 5, delayMs = 2500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const vector = await embedFn(text);
      if (!Array.isArray(vector) || vector.length !== 768) {
        throw new Error(
          `Expected 768 dimensions from embeddingService, got ${vector?.length || 0}`
        );
      }
      return vector;
    } catch (err) {
      const msg = err?.message || '';
      const isRateLimit =
        msg.includes('429') ||
        err?.status === 429 ||
        msg.toLowerCase().includes('quota') ||
        msg.toLowerCase().includes('rate');

      if (attempt < retries && isRateLimit) {
        console.warn(
          `[Rate limit 429] Waiting ${delayMs / 1000}s before retry attempt ${attempt + 1}/${retries}...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
      } else if (attempt < retries) {
        console.warn(`[Warning] ${msg}. Retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Finds and embeds visible (non-hidden) TouristPlace documents missing an embedding or marked stale.
 * Strictly skips hidden records (hidden: true).
 */
export async function embedTouristPlaces({
  TouristPlaceModel = TouristPlace,
  embedFn = embedText,
  connect = true,
  closeConnection = true,
  throttleMs = 300,
  logger = console,
} = {}) {
  const shouldConnect = connect && mongoose.connection.readyState === 0;
  if (shouldConnect) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey && embedFn === embedText) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    logger.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    logger.log('Connected to MongoDB successfully.');
  }

  try {
    const totalAll = await TouristPlaceModel.countDocuments({});
    const rawCandidates = await TouristPlaceModel.find(EMBED_UNEMBEDDED_QUERY);
    // Defensive in-memory guard: never embed hidden records even if a mock ignores query filters
    const placesToEmbed = (rawCandidates || []).filter((p) => p && p.hidden !== true);
    const alreadyEmbeddedCount = Math.max(0, totalAll - placesToEmbed.length);

    logger.log(`\n======================================================`);
    logger.log(`TOURIST PLACES EMBEDDING SCRIPT`);
    logger.log(`======================================================`);
    logger.log(`Total documents in collection: ${totalAll}`);
    logger.log(`Already embedded / hidden:     ${alreadyEmbeddedCount}`);
    logger.log(`Pending visible embedding:     ${placesToEmbed.length}`);
    logger.log(`======================================================\n`);

    if (placesToEmbed.length === 0) {
      logger.log('All visible documents already have current 768-dim embeddings. Nothing to do!');
      return { totalAll, embeddedCount: 0, errorCount: 0 };
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < placesToEmbed.length; i++) {
      const place = placesToEmbed[i];
      const text = buildDescriptiveText(place);

      try {
        const vector = await embedWithRetry(text, embedFn);
        await TouristPlaceModel.updateOne(
          { _id: place._id },
          { $set: { embedding: vector, embeddingStale: false } }
        );
        successCount++;
        if (successCount % 10 === 0 || i === placesToEmbed.length - 1) {
          logger.log(`Processed [${i + 1}/${placesToEmbed.length}] -> "${place.name}" (${place.city})`);
        }
      } catch (err) {
        errorCount++;
        logger.error(`Failed to embed "${place.name}" (${place._id}):`, err.message);
      }

      if (throttleMs > 0 && i < placesToEmbed.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, throttleMs));
      }
    }

    logger.log(`\nEmbedding finished! Success: ${successCount}, Errors: ${errorCount}`);
    return { totalAll, embeddedCount: successCount, errorCount };
  } finally {
    if (shouldConnect && closeConnection) {
      await mongoose.connection.close();
      logger.log('Database connection closed.');
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  embedTouristPlaces()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Embedding script error:', err.message);
      mongoose.connection.close().finally(() => process.exit(1));
    });
}
