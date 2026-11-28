/**
 * Safe dry-run migration script to normalize TouristPlace state spelling:
 *   "Maharastra" -> "Maharashtra"
 *
 * Defaults to DRY RUN (read-only). Pass `--apply` to execute updates.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import 'dotenv/config';

import TouristPlace from '../src/models/TouristPlace.js';

const __filename = fileURLToPath(import.meta.url);

export async function runMaharastraMigration({
  apply = false,
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
    await mongoose.connect(mongoUri);
  }

  try {
    const filter = { state: 'Maharastra' };
    const matches = await TouristPlaceModel.find(filter)
      .select('_id name city state type source hidden')
      .sort({ city: 1, name: 1 })
      .lean();

    logger.log(`[${apply ? 'APPLY' : 'DRY-RUN'}] Found ${matches.length} TouristPlace record(s) with state "Maharastra":`);
    matches.forEach((doc, idx) => {
      logger.log(
        `  ${idx + 1}. id=${doc._id} | name=${doc.name} | city=${doc.city} | state=${doc.state} -> Maharashtra | source=${doc.source || 'null'} | hidden=${Boolean(doc.hidden)}`
      );
    });

    if (!apply) {
      logger.log('Dry-run complete. No documents were modified. Re-run with --apply to commit changes.');
      return { dryRun: true, matchedCount: matches.length, modifiedCount: 0, matches };
    }

    const res = await TouristPlaceModel.updateMany(filter, {
      $set: { state: 'Maharashtra' },
    });
    logger.log(`Applied migration: modified ${res.modifiedCount || 0} of ${matches.length} document(s).`);
    return {
      dryRun: false,
      matchedCount: matches.length,
      modifiedCount: res.modifiedCount || 0,
      matches,
    };
  } finally {
    if (shouldConnect && closeConnection) {
      await mongoose.connection.close();
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const apply = process.argv.includes('--apply');
  runMaharastraMigration({ apply })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err.message);
      mongoose.connection.close().finally(() => process.exit(1));
    });
}
