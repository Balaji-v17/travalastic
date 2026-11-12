/**
 * Seed script for Style Collections.
 *
 * Idempotent:
 * Creates the style collection document ONLY if its key doesn't already exist.
 * Never overwrites edits made by content editors or super admins.
 *
 * Usage:
 * - Local: node scripts/seedStyleCollections.js
 *   (or npm run seed:styles)
 * - Render / CI build command:
 *   node scripts/seedStyleCollections.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import 'dotenv/config';

import StyleCollection, { ALLOWED_STYLE_KEYS } from '../src/models/StyleCollection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedStyleCollections({ connect = true, closeConnection = true } = {}) {
  const mongoUri = process.env.MONGODB_URI;
  const shouldConnect = connect && mongoose.connection.readyState === 0;
  if (shouldConnect) {
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB successfully.');
  }

  const dataPath = path.resolve(__dirname, '../seed/styleCollections.json');
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Data file not found at ${dataPath}`);
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const collections = JSON.parse(rawData);

  if (!Array.isArray(collections)) {
    throw new Error('Data file does not contain an array of style collections');
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const item of collections) {
    if (!ALLOWED_STYLE_KEYS.includes(item.key)) {
      console.warn(`Skipping invalid style key: "${item.key}"`);
      continue;
    }

    const existing = await StyleCollection.findOne({ key: item.key });
    if (!existing) {
      await StyleCollection.create({
        key: item.key,
        picks: item.picks || [],
        version: 1,
      });
      createdCount++;
      console.log(`Created style collection: "${item.key}" with ${item.picks?.length || 0} picks.`);
    } else {
      skippedCount++;
      console.log(`Style collection "${item.key}" already exists (version ${existing.version}) - leaving untouched.`);
    }
  }

  console.log(`Seed summary: ${createdCount} created, ${skippedCount} skipped (already present).`);

  if (shouldConnect && closeConnection) {
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }

  return { createdCount, skippedCount };
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedStyleCollections()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error seeding style collections:', err);
      mongoose.connection.close().finally(() => process.exit(1));
    });
}
