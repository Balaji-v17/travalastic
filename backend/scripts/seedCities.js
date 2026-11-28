/**
 * Idempotent seed script for World Cities & Regions (SimpleMaps Basic World Cities, CC BY 4.0).
 *
 * - Parses backend/seed/data/worldcities.csv using csv-parse (no network access).
 * - Validates coordinates (-90..90, -180..180) and required fields; skips invalid rows with count.
 * - Upserts City documents by sourceId in batches of 1000 and derives Region documents from
 *   distinct (admin_name, country) pairs with averaged, rounded coordinates.
 * - Never deletes other collections.
 * - Runs syncIndexes() after upserting so { searchKey, population } exists even when autoIndex is off.
 *
 * Usage:
 *   npm run seed:cities
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import 'dotenv/config';

import City from '../src/models/City.js';
import Region from '../src/models/Region.js';
import { normalizeSearchKey } from '../src/utils/cityNormalizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_CSV_PATH = path.resolve(__dirname, '../seed/data/worldcities.csv');
export const DEFAULT_BATCH_SIZE = 1000;

/**
 * Parses CSV content using csv-parse (handles quoted fields and commas inside values).
 */
export function parseCitiesCsv(csvText) {
  if (typeof csvText !== 'string' || !csvText.trim()) {
    return [];
  }
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

/**
 * Validates and transforms a raw CSV row into a City document payload.
 */
export function validateAndTransformCityRow(row) {
  if (!row || typeof row !== 'object') {
    return { valid: false, reason: 'empty_row' };
  }

  const sourceId = String(row.id ?? '').trim();
  const name = String(row.city ?? '').trim();
  const nameAscii = String(row.city_ascii ?? '').trim();
  const country = String(row.country ?? '').trim();
  const iso2 = String(row.iso2 ?? '').trim().toUpperCase();
  const iso3 = String(row.iso3 ?? '').trim().toUpperCase();
  const admin = String(row.admin_name ?? '').trim();
  const capital = String(row.capital ?? '').trim();

  if (!sourceId || !name || !country) {
    return { valid: false, reason: 'missing_required_field' };
  }

  const rawLat = String(row.lat ?? '').trim();
  const rawLng = String(row.lng ?? '').trim();
  if (!rawLat || !rawLng) {
    return { valid: false, reason: 'missing_coordinates' };
  }

  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { valid: false, reason: 'invalid_lat' };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { valid: false, reason: 'invalid_lng' };
  }

  let population = null;
  const rawPop = String(row.population ?? '').trim();
  if (rawPop !== '') {
    const parsedPop = Number(rawPop);
    if (!Number.isFinite(parsedPop) || parsedPop < 0) {
      return { valid: false, reason: 'invalid_population' };
    }
    population = Math.round(parsedPop);
  }

  const searchKey = normalizeSearchKey(name) || normalizeSearchKey(nameAscii);
  if (!searchKey) {
    return { valid: false, reason: 'empty_search_key' };
  }

  return {
    valid: true,
    city: {
      sourceId,
      name,
      nameAscii,
      searchKey,
      country,
      iso2,
      iso3,
      admin,
      capital,
      population,
      lat,
      lng,
    },
  };
}

/**
 * Builds distinct Region suggestions from validated City rows, grouping by (admin_name, country)
 * and computing rounded average coordinates.
 */
export function buildRegionsFromCities(cities) {
  const buckets = new Map();

  for (const city of cities) {
    if (!city.admin || !city.country) continue;
    const regionSearchKey = normalizeSearchKey(city.admin);
    const countryKey = normalizeSearchKey(city.country);
    if (!regionSearchKey || !countryKey) continue;

    const sourceKey = `${regionSearchKey}::${countryKey}`;
    const existing = buckets.get(sourceKey);
    if (!existing) {
      buckets.set(sourceKey, {
        sourceKey,
        name: city.admin,
        searchKey: regionSearchKey,
        country: city.country,
        iso2: city.iso2 || '',
        sumLat: city.lat,
        sumLng: city.lng,
        count: 1,
      });
    } else {
      existing.sumLat += city.lat;
      existing.sumLng += city.lng;
      existing.count += 1;
      if (!existing.iso2 && city.iso2) {
        existing.iso2 = city.iso2;
      }
    }
  }

  const regions = [];
  for (const bucket of buckets.values()) {
    regions.push({
      sourceKey: bucket.sourceKey,
      name: bucket.name,
      searchKey: bucket.searchKey,
      country: bucket.country,
      iso2: bucket.iso2,
      lat: Math.round((bucket.sumLat / bucket.count) * 10000) / 10000,
      lng: Math.round((bucket.sumLng / bucket.count) * 10000) / 10000,
    });
  }
  return regions;
}

async function upsertInBatches(Model, docs, keyField, batchSize) {
  let inserted = 0;
  let updated = 0;
  let matched = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const ops = batch.map((doc) => ({
      updateOne: {
        filter: { [keyField]: doc[keyField] },
        update: { $set: doc },
        upsert: true,
      },
    }));

    const res = await Model.bulkWrite(ops, { ordered: false });
    inserted += res.upsertedCount || 0;
    updated += res.modifiedCount || 0;
    matched += res.matchedCount || 0;
  }

  return { inserted, updated, matched };
}

async function getCollectionStats(Model) {
  const count = await Model.countDocuments({});
  let sizeBytes = null;
  let storageSizeBytes = null;
  let totalIndexSizeBytes = null;

  try {
    const db = Model.db?.db;
    if (db && typeof db.command === 'function') {
      const stats = await db.command({ collStats: Model.collection.name });
      sizeBytes = stats?.size ?? null;
      storageSizeBytes = stats?.storageSize ?? null;
      totalIndexSizeBytes = stats?.totalIndexSize ?? null;
    }
  } catch {
    // Fallback if collStats is unavailable (e.g. mocked Model in tests)
  }

  return { count, sizeBytes, storageSizeBytes, totalIndexSizeBytes };
}

function formatMB(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return 'n/a';
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Seeds City and Region collections idempotently from CSV.
 */
export async function seedCities({
  csvPath = DEFAULT_CSV_PATH,
  batchSize = DEFAULT_BATCH_SIZE,
  connect = true,
  closeConnection = true,
  CityModel = City,
  RegionModel = Region,
  logger = console,
} = {}) {
  const shouldConnect = connect && mongoose.connection.readyState === 0;
  if (shouldConnect) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }
    logger.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    logger.log('Connected to MongoDB.');
  }

  try {
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at ${csvPath}`);
    }

    const csvText = fs.readFileSync(csvPath, 'utf8');
    const rawRows = parseCitiesCsv(csvText);

    const validCities = [];
    let skipped = 0;
    for (const row of rawRows) {
      const result = validateAndTransformCityRow(row);
      if (result.valid) {
        validCities.push(result.city);
      } else {
        skipped++;
      }
    }

    const cityResult = await upsertInBatches(CityModel, validCities, 'sourceId', batchSize);
    const regions = buildRegionsFromCities(validCities);
    const regionResult = await upsertInBatches(RegionModel, regions, 'sourceKey', batchSize);

    if (typeof CityModel.syncIndexes === 'function') {
      await CityModel.syncIndexes();
    }
    if (typeof RegionModel.syncIndexes === 'function') {
      await RegionModel.syncIndexes();
    }

    const cityStats = await getCollectionStats(CityModel);
    const regionStats = await getCollectionStats(RegionModel);

    logger.log(
      `Cities seed complete: inserted=${cityResult.inserted}, updated=${cityResult.updated}, unchanged=${Math.max(0, cityResult.matched - cityResult.updated)}, skipped=${skipped}`
    );
    logger.log(
      `Regions seed complete: inserted=${regionResult.inserted}, updated=${regionResult.updated}, unchanged=${Math.max(0, regionResult.matched - regionResult.updated)}`
    );
    logger.log(
      `Collection stats — cities: ${cityStats.count} docs (data: ${formatMB(cityStats.sizeBytes)}, storage: ${formatMB(cityStats.storageSizeBytes)}, indexes: ${formatMB(cityStats.totalIndexSizeBytes)}); regions: ${regionStats.count} docs (data: ${formatMB(regionStats.sizeBytes)}, storage: ${formatMB(regionStats.storageSizeBytes)}, indexes: ${formatMB(regionStats.totalIndexSizeBytes)})`
    );

    return {
      totalRows: rawRows.length,
      validCount: validCities.length,
      inserted: cityResult.inserted,
      updated: cityResult.updated,
      skipped,
      regionsInserted: regionResult.inserted,
      regionsUpdated: regionResult.updated,
      regionsCount: regions.length,
      cityStats,
      regionStats,
    };
  } finally {
    if (shouldConnect && closeConnection) {
      await mongoose.connection.close();
      logger.log('Database connection closed.');
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  seedCities()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error seeding cities:', err.message);
      mongoose.connection.close().finally(() => process.exit(1));
    });
}

