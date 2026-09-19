import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import 'dotenv/config';

import CuratedHotel from '../src/models/CuratedHotel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedHotels() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  const dataPath = path.resolve(__dirname, '../data/curated_hotels.json');
  if (!fs.existsSync(dataPath)) {
    console.error(`Error: Data file not found at ${dataPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataPath, 'utf8');
  const hotels = JSON.parse(rawData);

  if (!Array.isArray(hotels)) {
    console.error('Error: Data file does not contain an array of hotels');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.');

  let upsertedCount = 0;
  for (const hotel of hotels) {
    await CuratedHotel.findOneAndUpdate(
      { destination: hotel.destination, name: hotel.name },
      { $set: hotel },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    upsertedCount++;
  }

  console.log(`Successfully upserted ${upsertedCount} curated hotels into the database.`);
  await mongoose.connection.close();
  console.log('Database connection closed.');
}

seedHotels().catch((err) => {
  console.error('Error seeding hotels:', err);
  mongoose.connection.close().finally(() => process.exit(1));
});
