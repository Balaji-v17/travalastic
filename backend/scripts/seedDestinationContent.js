import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import 'dotenv/config';

import embedText from '../src/services/embeddingService.js';
import DestinationContent from '../src/models/DestinationContent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedDestinationContent() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('Error: GEMINI_API_KEY is not defined in environment variables');
    process.exit(1);
  }

  const dataPath = path.resolve(__dirname, '../data/destination_content.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Error: Data file not found at ${dataPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const items = JSON.parse(rawData);

  if (!Array.isArray(items) || items.length === 0) {
    console.error('Error: destination_content.json must contain a non-empty array');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.');

  console.log(`Generating embeddings and seeding ${items.length} destination content entries...`);
  let upsertedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`[${i + 1}/${items.length}] Generating embedding for: "${item.text.slice(0, 40)}..."`);
    
    const embedding = await embedText(item.text);

    await DestinationContent.findOneAndUpdate(
      { text: item.text },
      {
        $set: {
          text: item.text,
          tags: item.tags || [],
          embedding: embedding,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    upsertedCount++;
  }

  console.log(`Successfully upserted ${upsertedCount} destination content entries with 768-dim embeddings.`);
  await mongoose.connection.close();
  console.log('Database connection closed.');
}

seedDestinationContent().catch((err) => {
  console.error('Error seeding destination content:', err);
  mongoose.connection.close().finally(() => process.exit(1));
});
