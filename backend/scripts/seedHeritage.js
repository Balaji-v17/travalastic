/**
 * Idempotent importer for India's ASI & Survey of India heritage monuments.
 *
 * - Reads backend/seed/data/heritage/heritage_sites.csv using csv-parse (no network calls, no embedding API calls).
 * - Cleans text, normalizes state spellings, flags quality issues (coords_outside_india, broken_text,
 *   no_description, possible_duplicate, state_unmapped, generic_name), and groups duplicates by
 *   (normalized name, district, state), keeping ASI over SOI and linking merged IDs on the representative.
 * - Upserts into TouristPlace by unique sparse `sourceId` (= entity_uid) using $setOnInsert so
 *   re-runs are idempotent and never overwrite admin reviews or edits.
 * - Calls syncIndexes() after upserting and prints flag & collection stats.
 *
 * Usage:
 *   npm run seed:heritage
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import 'dotenv/config';

import TouristPlace from '../src/models/TouristPlace.js';
import {
  ALL_REVIEW_FLAGS,
  HERITAGE_SOURCE,
  applyCuratedOverlapFlags,
  resolveHeritageGroupsAndDuplicates,
  resolveRepeatedEntityUids,
  transformHeritageRow,
} from '../src/utils/heritageProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_HERITAGE_CSV_PATH = path.resolve(
  __dirname,
  '../seed/data/heritage/heritage_sites.csv'
);
export const DEFAULT_BATCH_SIZE = 500;

export function parseHeritageCsv(csvText) {
  if (typeof csvText !== 'string' || !csvText.trim()) {
    return [];
  }
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
}

function summarizeFlags(docs) {
  const flagCounts = {};
  for (const flag of ALL_REVIEW_FLAGS) {
    flagCounts[flag] = 0;
  }
  let pendingReview = 0;
  let duplicate = 0;

  for (const doc of docs) {
    if (doc.hiddenReason === 'duplicate') duplicate++;
    else pendingReview++;

    for (const flag of doc.reviewFlags || []) {
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    }
  }

  return { flagCounts, pendingReview, duplicate };
}

async function getCollectionStats(Model) {
  const totalCount = await Model.countDocuments({});
  const heritageCount = await Model.countDocuments({ source: HERITAGE_SOURCE });
  const visibleCount = await Model.countDocuments({ hidden: { $ne: true } });
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
    // Fallback when collStats is unavailable (e.g. unit test mocks)
  }

  return { totalCount, heritageCount, visibleCount, sizeBytes, storageSizeBytes, totalIndexSizeBytes };
}

function formatMB(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return 'n/a';
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Seeds heritage monuments idempotently into TouristPlace without calling any embedding API.
 */
export async function seedHeritage({
  csvPath = DEFAULT_HERITAGE_CSV_PATH,
  batchSize = DEFAULT_BATCH_SIZE,
  connect = true,
  closeConnection = true,
  TouristPlaceModel = TouristPlace,
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
      throw new Error(`Heritage CSV file not found at ${csvPath}`);
    }

    const csvText = fs.readFileSync(csvPath, 'utf8');
    const rawRows = parseHeritageCsv(csvText);

    const candidates = [];
    let skipped = 0;

    for (const row of rawRows) {
      const transformed = transformHeritageRow(row);
      if (transformed.valid) {
        candidates.push(transformed);
      } else {
        skipped++;
      }
    }

    if (typeof TouristPlaceModel.syncIndexes === 'function') {
      await TouristPlaceModel.syncIndexes();
    }

    const { candidates: uniqueCandidates, stats: repeatStats } =
      resolveRepeatedEntityUids(candidates);
    const docs = resolveHeritageGroupsAndDuplicates(uniqueCandidates);

    let curatedPlaces = [];
    if (typeof TouristPlaceModel.find === 'function') {
      const q = TouristPlaceModel.find({ source: { $ne: HERITAGE_SOURCE } });
      if (q && typeof q.select === 'function') {
        curatedPlaces = await q.select('_id name city state latitude longitude source').lean();
      } else {
        curatedPlaces = Array.isArray(q) ? q : await q;
      }
    }

    const curatedMatchedCount = applyCuratedOverlapFlags(docs, curatedPlaces || []);
    const { flagCounts, pendingReview, duplicate } = summarizeFlags(docs);

    let inserted = 0;
    let updated = 0;
    let matched = 0;

    const now = new Date();

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const ops = batch.map((doc) => ({
        updateOne: {
          filter: { sourceId: doc.sourceId },
          update: {
            $setOnInsert: {
              createdAt: now,
              updatedAt: now,
              ...doc,
            },
          },
          upsert: true,
        },
      }));

      const res = await TouristPlaceModel.bulkWrite(ops, { ordered: false, timestamps: false });
      inserted += res.upsertedCount || 0;
      updated += res.modifiedCount || 0;
      matched += res.matchedCount || 0;
    }

    // Backfill heritage.extraCoords and matches_curated on untouched existing records only
    // (never touches published, rejected, or already_curated records).
    const backfillOps = [];
    for (const doc of docs) {
      if (Array.isArray(doc.heritage?.extraCoords) && doc.heritage.extraCoords.length > 0) {
        backfillOps.push({
          updateOne: {
            filter: {
              sourceId: doc.sourceId,
              hidden: true,
              hiddenReason: { $in: ['pending_review', 'duplicate'] },
              'heritage.extraCoords': { $ne: doc.heritage.extraCoords },
            },
            update: {
              $set: { 'heritage.extraCoords': doc.heritage.extraCoords },
            },
          },
        });
      }

      if (doc.reviewFlags?.includes('matches_curated') && doc.heritage?.matchedCuratedPlace) {
        backfillOps.push({
          updateOne: {
            filter: {
              sourceId: doc.sourceId,
              hidden: true,
              hiddenReason: { $in: ['pending_review', 'duplicate'] },
              reviewFlags: { $ne: 'matches_curated' },
            },
            update: {
              $addToSet: { reviewFlags: 'matches_curated' },
              $set: { 'heritage.matchedCuratedPlace': doc.heritage.matchedCuratedPlace },
            },
          },
        });
      }
    }

    let backfillModified = 0;
    for (let i = 0; i < backfillOps.length; i += batchSize) {
      const batch = backfillOps.slice(i, i + batchSize);
      const res = await TouristPlaceModel.bulkWrite(batch, { ordered: false, timestamps: false });
      const modCount = res.modifiedCount || 0;
      backfillModified += modCount;
      updated += modCount;
    }

    const stats = await getCollectionStats(TouristPlaceModel);
    const unchanged = Math.max(0, matched - backfillModified);

    logger.log(
      `Heritage seed complete: addedRecords=${inserted}, updated=${updated}, unchanged=${unchanged}, skipped=${skipped}`
    );
    logger.log(
      `Repeated entity_uid resolution: addedDistinctRepeats=${repeatStats.addedDistinctRepeats}, skippedExactRepeats=${repeatStats.skippedExactRepeats}, coordinateOnlyRepeats=${repeatStats.coordinateOnlyRepeats}`
    );
    logger.log(
      `Groups & visibility: pending_review=${pendingReview}, duplicate=${duplicate}, matches_curated=${curatedMatchedCount}`
    );
    logger.log(`Flag counts: ${JSON.stringify(flagCounts)}`);
    logger.log(
      `Collection stats — touristplaces: ${stats.totalCount} total (${stats.visibleCount} visible, ${stats.heritageCount} heritage; data: ${formatMB(stats.sizeBytes)}, storage: ${formatMB(stats.storageSizeBytes)}, indexes: ${formatMB(stats.totalIndexSizeBytes)})`
    );

    return {
      totalRows: rawRows.length,
      processedCount: docs.length,
      inserted,
      addedRecords: inserted,
      updated,
      unchanged,
      skipped,
      repeatStats,
      curatedMatchedCount,
      pendingReview,
      duplicate,
      flagCounts,
      stats,
    };
  } finally {
    if (shouldConnect && closeConnection) {
      await mongoose.connection.close();
      logger.log('Database connection closed.');
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  seedHeritage()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error seeding heritage monuments:', err.message);
      mongoose.connection.close().finally(() => process.exit(1));
    });
}
