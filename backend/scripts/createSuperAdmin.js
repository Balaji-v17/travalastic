import 'dotenv/config';
import readline from 'readline';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import AdminUser from '../src/models/AdminUser.js';
import { connectDB } from '../src/config/db.js';

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 12;

/**
 * Pure programmatic function to create a super admin.
 * Used both by the CLI script and unit/integration tests.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<Object>} Safe admin user object
 */
export async function createSuperAdminRecord({ email, password }) {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new Error('Email is required');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Invalid email format');
  }

  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  const existing = await AdminUser.findOne({ email: normalizedEmail });
  if (existing) {
    throw new Error(`Admin with email "${normalizedEmail}" already exists`);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const admin = await AdminUser.create({
    email: normalizedEmail,
    passwordHash,
    role: 'super_admin',
    active: true,
    createdBy: null,
  });

  return admin.toSafeObject ? admin.toSafeObject() : {
    id: admin._id.toString(),
    email: admin.email,
    role: admin.role,
    active: admin.active,
  };
}

/**
 * Helper to prompt interactively via standard input.
 */
function promptInput(query, hidden = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * CLI Execution Entry Point
 */
async function runCLI() {
  let email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  let password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email) {
    email = await promptInput('Enter super admin email: ');
  }

  if (!password) {
    password = await promptInput('Enter super admin password (min 12 chars): ');
  }

  try {
    await connectDB();
    const admin = await createSuperAdminRecord({ email, password });
    console.log(`Successfully created super admin: ${admin.email} (id: ${admin.id})`);
    process.exit(0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

// Run CLI directly if invoked from node
if (process.argv[1] && process.argv[1].endsWith('createSuperAdmin.js')) {
  runCLI();
}

