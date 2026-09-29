import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';

import TouristPlace from '../src/models/TouristPlace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importTouristPlaces() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is not set in environment variables');
    process.exit(1);
  }

  // Primary expected path: backend/data/tourist_places.csv
  let dataPath = path.resolve(__dirname, '../data/tourist_places.csv');

  // Fallback to original Kaggle filename if user saved it under default name
  if (!fs.existsSync(dataPath)) {
    const fallbackPath = path.resolve(__dirname, '../data/Top Indian Places to Visit.csv');
    if (fs.existsSync(fallbackPath)) {
      dataPath = fallbackPath;
    } else {
      console.error(`Error: tourist_places.csv not found at ${dataPath}`);
      console.error('Please download "Travel Dataset: Guide To India\'s Must See Places" by saketk511 from Kaggle');
      console.error('and save it to backend/data/tourist_places.csv.');
      process.exit(1);
    }
  }

  console.log(`Reading CSV data from: ${dataPath}`);
  const fileContent = fs.readFileSync(dataPath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (!Array.isArray(records) || records.length === 0) {
    console.error('Error: CSV file contains no valid rows or is empty');
    process.exit(1);
  }

  console.log(`Parsed ${records.length} rows from CSV.`);

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.');

  const distinctTypes = new Set();
  let upsertedCount = 0;
  let skippedCount = 0;

  for (const row of records) {
    // Normalizing column names regardless of minor spacing or casing discrepancies
    const name = row['Name'] || row['name'];
    const city = row['City'] || row['city'];

    if (!name || !city) {
      skippedCount++;
      continue;
    }

    const state = row['State'] || row['state'] || '';
    const zone = row['Zone'] || row['zone'] || '';
    const type = row['Type'] || row['type'] || '';
    const significance = row['Significance'] || row['significance'] || '';

    if (type) {
      distinctTypes.add(type);
    }

    const rawRating = row['Google review rating'] || row['googleRating'] || row['rating'];
    const parsedRating = rawRating ? parseFloat(rawRating) : null;
    const googleRating = !isNaN(parsedRating) ? parsedRating : null;

    const rawFee = row['Entrance Fee in INR'] || row['entranceFeeINR'] || row['fee'];
    const parsedFee = rawFee ? parseFloat(rawFee) : 0;
    const entranceFeeINR = !isNaN(parsedFee) ? parsedFee : 0;

    const rawHours =
      row['time needed to visit in hrs'] ||
      row['Time needed to visit in hrs'] ||
      row['timeNeededHours'] ||
      row['time_needed'];
    const parsedHours = rawHours ? parseFloat(rawHours) : null;
    const timeNeededHours = !isNaN(parsedHours) ? parsedHours : null;

    const bestTimeToVisit = row['Best Time to visit'] || row['bestTimeToVisit'] || '';

    const placeData = {
      name: name.trim(),
      city: city.trim(),
      state: state.trim(),
      zone: zone.trim(),
      type: type.trim(),
      significance: significance.trim(),
      googleRating,
      entranceFeeINR,
      timeNeededHours,
      bestTimeToVisit: bestTimeToVisit.trim(),
    };

    // Upsert matching on name + city to prevent duplicates on repeated runs
    await TouristPlace.findOneAndUpdate(
      { name: placeData.name, city: placeData.city },
      { $set: placeData },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    upsertedCount++;
  }

  console.log(`\n======================================================`);
  console.log(`IMPORT SUMMARY`);
  console.log(`======================================================`);
  console.log(`Successfully upserted: ${upsertedCount} tourist places.`);
  if (skippedCount > 0) {
    console.log(`Skipped rows (missing name or city): ${skippedCount}`);
  }
  console.log(`\nDistinct "Type" column values found (${distinctTypes.size} total):`);
  const sortedTypes = Array.from(distinctTypes).sort();
  sortedTypes.forEach((t, i) => {
    console.log(`  ${i + 1}. "${t}"`);
  });
  console.log(`======================================================\n`);

  await mongoose.connection.close();
  console.log('Database connection closed.');
}

importTouristPlaces().catch((err) => {
  console.error('Error importing tourist places:', err);
  mongoose.connection.close().finally(() => process.exit(1));
});
