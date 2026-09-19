import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import 'dotenv/config';

import CuratedRoute from '../src/models/CuratedRoute.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedRoutes() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  const dataPath = path.resolve(__dirname, '../data/curated_routes.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Error: Data file not found at ${dataPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const routes = JSON.parse(rawData);

  if (!Array.isArray(routes)) {
    console.error('Error: Data file does not contain an array of routes');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.');

  let upsertedCount = 0;
  for (const route of routes) {
    await CuratedRoute.findOneAndUpdate(
      { origin: route.origin, destination: route.destination, mode: route.mode },
      { $set: route },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    upsertedCount++;
  }

  console.log(`Successfully upserted ${upsertedCount} curated routes into MongoDB.`);
  await mongoose.connection.close();
  console.log('Database connection closed.');
}

seedRoutes().catch((err) => {
  console.error('Error seeding routes:', err);
  mongoose.connection.close().finally(() => process.exit(1));
});

