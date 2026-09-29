import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import 'dotenv/config';

import embedText from '../src/services/embeddingService.js';
import TouristPlace from '../src/models/TouristPlace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Builds descriptive text from name + type + significance + city
 * e.g. "Golden Temple, a Religious site in Amritsar, Punjab"
 */
export function buildDescriptiveText(place) {
  const { name, type, significance, city, state } = place;

  const descriptors = [];
  if (type) descriptors.push(type);
  if (significance && (!type || !type.toLowerCase().includes(significance.toLowerCase()))) {
    descriptors.push(significance);
  }

  const descriptorPhrase =
    descriptors.length > 0 ? `a ${descriptors.join(' ')} site` : 'a destination';

  let text = `${name}, ${descriptorPhrase}`;
  if (city) {
    text += ` in ${city}`;
    if (state && state.toLowerCase() !== city.toLowerCase()) {
      text += `, ${state}`;
    }
  }

  return text;
}

/**
 * Helper to call embedText with retry and exponential backoff for rate limits.
 */
async function embedWithRetry(text, retries = 5, delayMs = 2500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const vector = await embedText(text);
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

async function embedTouristPlaces() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('Error: GEMINI_API_KEY is not set in environment variables');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.');

  // Find all TouristPlace documents without an embedding yet
  const queryUnembedded = {
    $or: [
      { embedding: { $exists: false } },
      { embedding: null },
      { embedding: { $size: 0 } },
    ],
  };

  const totalAll = await TouristPlace.countDocuments({});
  const placesToEmbed = await TouristPlace.find(queryUnembedded);
  const alreadyEmbeddedCount = totalAll - placesToEmbed.length;

  console.log(`\n======================================================`);
  console.log(`TOURIST PLACES EMBEDDING SCRIPT`);
  console.log(`======================================================`);
  console.log(`Total documents in collection: ${totalAll}`);
  console.log(`Already embedded (skipping):    ${alreadyEmbeddedCount}`);
  console.log(`Pending embedding:             ${placesToEmbed.length}`);
  console.log(`======================================================\n`);

  if (placesToEmbed.length === 0) {
    console.log('All documents already have 768-dim embeddings. Nothing to do!');
    await mongoose.connection.close();
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < placesToEmbed.length; i++) {
    const doc = placesToEmbed[i];

    // Double-check: skip documents that already have an embedding
    if (Array.isArray(doc.embedding) && doc.embedding.length === 768) {
      continue;
    }

    const descText = buildDescriptiveText(doc);

    try {
      console.log(
        `[${i + 1}/${placesToEmbed.length}] Embedding: "${descText.slice(0, 70)}..."`
      );

      const embeddingVector = await embedWithRetry(descText);

      await TouristPlace.updateOne(
        { _id: doc._id },
        { $set: { embedding: embeddingVector } }
      );

      successCount++;

      // Gentle pause to respect Gemini API rate limits
      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (err) {
      console.error(`Failed to embed place "${doc.name}":`, err.message);
      failCount++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`EMBEDDING COMPLETE`);
  console.log(`======================================================`);
  console.log(`Newly embedded: ${successCount}`);
  console.log(`Failed:         ${failCount}`);
  console.log(`Skipped (prior): ${alreadyEmbeddedCount}`);
  console.log(`Total embedded: ${alreadyEmbeddedCount + successCount}/${totalAll}`);
  console.log(`======================================================\n`);

  await mongoose.connection.close();
  console.log('Database connection closed.');
}

// Execute if run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('embedTouristPlaces.js')) {
  embedTouristPlaces().catch((err) => {
    console.error('Fatal error during embedding execution:', err);
    mongoose.connection.close().finally(() => process.exit(1));
  });
}
