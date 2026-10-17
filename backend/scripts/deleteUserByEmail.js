#!/usr/bin/env node

/**
 * Support-side Account Deletion Script
 *
 * Usage:
 *   Dry run:   node scripts/deleteUserByEmail.js <email>
 *   Deletion:  node scripts/deleteUserByEmail.js <email> --confirm <email>
 */

import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import User from '../src/models/User.js';
import { countUserData, deleteUserAndData } from '../src/services/accountDeletion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from potential root or backend .env paths
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function extractDbTarget(uri) {
  try {
    const normalized = uri.replace(/^mongodb(\+srv)?:\/\//, 'http://');
    const u = new URL(normalized);
    const dbName = u.pathname.replace(/^\//, '').split('?')[0] || '(default)';
    return { host: u.host, dbName };
  } catch {
    const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@]+@)?([^/?#]+)(?:\/([^?#]+))?/);
    if (match) {
      return { host: match[1], dbName: (match[2] || '(default)').split('?')[0] };
    }
    return { host: 'unknown', dbName: 'unknown' };
  }
}

async function run() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: Target email required.');
    console.error('Usage: node scripts/deleteUserByEmail.js <email> [--confirm <email>]');
    process.exit(1);
  }

  const targetEmailRaw = args[0];
  if (targetEmailRaw.startsWith('--')) {
    console.error('Error: First argument must be the target email.');
    console.error('Usage: node scripts/deleteUserByEmail.js <email> [--confirm <email>]');
    process.exit(1);
  }

  const confirmIndex = args.indexOf('--confirm');
  const hasConfirmFlag = confirmIndex !== -1;
  const confirmEmailRaw = hasConfirmFlag ? args[confirmIndex + 1] : null;

  const targetEmail = normalizeEmail(targetEmailRaw);
  const confirmEmail = confirmEmailRaw ? normalizeEmail(confirmEmailRaw) : null;

  let isConfirmed = false;

  if (hasConfirmFlag) {
    if (!confirmEmailRaw) {
      console.error('Error: --confirm requires an email argument matching the target email.');
      console.error(`Example: node scripts/deleteUserByEmail.js ${targetEmailRaw} --confirm ${targetEmailRaw}`);
      process.exit(1);
    }

    if (targetEmail !== confirmEmail) {
      console.error('Error: Confirmation email does not match target email.');
      console.error(`  Target:       "${targetEmailRaw}" (normalized: "${targetEmail}")`);
      console.error(`  Confirmation: "${confirmEmailRaw}" (normalized: "${confirmEmail}")`);
      console.error('Operation aborted. No changes made.');
      process.exit(1);
    }

    isConfirmed = true;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is not set in environment variables.');
    process.exit(1);
  }

  // Print target database name and cluster host without credentials
  const { host, dbName } = extractDbTarget(mongoUri);
  console.log(`Target cluster host: ${host}`);
  console.log(`Target database:     ${dbName}`);

  let exitCode = 0;

  try {
    await mongoose.connect(mongoUri);

    const user = await User.findOne({ email: targetEmail });
    if (!user) {
      console.error(`Error: No account exists for email "${targetEmailRaw}" (normalized: "${targetEmail}").`);
      exitCode = 1;
      return;
    }

    if (!isConfirmed) {
      // Default: Dry run
      const counts = await countUserData(user._id);

      console.log('\n--- DRY RUN (No data deleted) ---');
      console.log(`User ID:        ${user._id}`);
      console.log(`Account Email:  ${user.email}`);
      console.log('\nPer-collection records found:');
      console.log(`  Itineraries:       ${counts.itineraries}`);
      console.log(`  Conversations:     ${counts.conversations}`);
      console.log(`  Expenses:          ${counts.expenses}`);
      console.log(`  Bookings:          ${counts.bookings}`);
      console.log(`  Packing Templates: ${counts.packingTemplates}`);
      console.log(`  Users:             ${counts.users}`);
      console.log('\nTo permanently delete this user and all data, run:');
      console.log(`  node scripts/deleteUserByEmail.js "${targetEmailRaw}" --confirm "${targetEmailRaw}"\n`);
      exitCode = 0;
    } else {
      // Confirmed deletion
      const deletedCounts = await deleteUserAndData(user._id);

      console.log('\n--- ACCOUNT DELETION COMPLETED ---');
      console.log('Per-collection deleted counts:');
      console.log(`  Itineraries:       ${deletedCounts.itineraries}`);
      console.log(`  Conversations:     ${deletedCounts.conversations}`);
      console.log(`  Expenses:          ${deletedCounts.expenses}`);
      console.log(`  Bookings:          ${deletedCounts.bookings}`);
      console.log(`  Packing Templates: ${deletedCounts.packingTemplates}`);
      console.log(`  Users:             ${deletedCounts.users}`);
      console.log(`User account deleted: ${user._id} (method: support)`);
      exitCode = 0;
    }
  } catch (err) {
    console.error(`Execution error: ${err.message}`);
    exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
}

run();

