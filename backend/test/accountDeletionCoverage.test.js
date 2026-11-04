import { describe, it } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { countUserData, deleteUserAndData } from '../src/services/accountDeletion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsDir = path.resolve(__dirname, '../src/models');

// Explicit, commented exemption list for models that do NOT belong to any single user
const EXEMPT_GLOBAL_MODELS = new Set([
  'CuratedHotel',       // Curated global hotel catalog; shared across all users
  'CuratedRoute',       // Static transportation route definitions
  'DestinationContent', // Scraped and curated destination embeddings/tags
  'TouristPlace',      // Global tourist places and attractions database
]);

describe('Account Deletion Model Coverage', () => {
  it('discovers all registered models and verifies deletion coverage', async () => {
    // 1. Automatically load all model files from backend/src/models
    const modelFiles = fs
      .readdirSync(modelsDir)
      .filter((file) => file.endsWith('.js') && !file.startsWith('.'));

    for (const file of modelFiles) {
      await import(`../src/models/${file}`);
    }

    const registeredModels = mongoose.modelNames();
    assert(registeredModels.length > 0, 'Should have discovered registered models');

    // Expected models in accountDeletion.js
    // User is handled via _id: userId; others via userId: userId
    const handledModels = new Set([
      'User',
      'Itinerary',
      'Conversation',
      'Expense',
      'Booking',
      'PackingTemplate',
      'Disruption',
    ]);

    const discoveredWithUserId = [];
    const missingFromDeletion = [];

    for (const modelName of registeredModels) {
      if (EXEMPT_GLOBAL_MODELS.has(modelName)) {
        continue;
      }

      const model = mongoose.model(modelName);
      const schemaPaths = Object.keys(model.schema.paths);
      const hasUserIdField = schemaPaths.includes('userId') || modelName === 'User';

      if (hasUserIdField) {
        discoveredWithUserId.push(modelName);
        if (!handledModels.has(modelName)) {
          missingFromDeletion.push(modelName);
        }
      } else {
        // If it doesn't have userId and is not exempt, fail
        assert.fail(
          `Model ${modelName} neither has a userId field nor is in EXEMPT_GLOBAL_MODELS`
        );
      }
    }

    assert.strictEqual(
      missingFromDeletion.length,
      0,
      `Models with userId not covered by accountDeletion: ${missingFromDeletion.join(', ')}`
    );

    // Verify all handled models were actually discovered
    for (const handled of handledModels) {
      assert(
        discoveredWithUserId.includes(handled),
        `Handled model ${handled} was not discovered in mongoose.modelNames()`
      );
    }
  });

  it('countUserData and deleteUserAndData execute queries targeted strictly by userId', async () => {
    const testUserId = new mongoose.Types.ObjectId();

    // Stub all models called by countUserData and deleteUserAndData
    const models = [
      mongoose.model('Itinerary'),
      mongoose.model('Conversation'),
      mongoose.model('Expense'),
      mongoose.model('Booking'),
      mongoose.model('PackingTemplate'),
      mongoose.model('Disruption'),
      mongoose.model('User'),
    ];

    const origMethods = models.map((m) => ({
      model: m,
      count: m.countDocuments,
      deleteMany: m.deleteMany,
      deleteOne: m.deleteOne,
    }));

    const countFilters = new Map();
    const deleteFilters = new Map();

    try {
      for (const m of models) {
        m.countDocuments = async (filter) => {
          countFilters.set(m.modelName, filter);
          return 1;
        };
        m.deleteMany = async (filter) => {
          deleteFilters.set(m.modelName, filter);
          return { deletedCount: 1 };
        };
        m.deleteOne = async (filter) => {
          deleteFilters.set(m.modelName, filter);
          return { deletedCount: 1 };
        };
      }

      const counts = await countUserData(testUserId);
      assert.strictEqual(counts.itineraries, 1);
      assert.strictEqual(counts.conversations, 1);
      assert.strictEqual(counts.expenses, 1);
      assert.strictEqual(counts.bookings, 1);
      assert.strictEqual(counts.packingTemplates, 1);
      assert.strictEqual(counts.disruptions, 1);
      assert.strictEqual(counts.users, 1);

      // Verify each filter checked userId (or _id for User)
      for (const m of models) {
        const filter = countFilters.get(m.modelName);
        if (m.modelName === 'User') {
          assert.strictEqual(filter._id.toString(), testUserId.toString());
        } else {
          assert.strictEqual(filter.userId.toString(), testUserId.toString());
        }
      }

      const deleted = await deleteUserAndData(testUserId);
      assert.strictEqual(deleted.itineraries, 1);
      assert.strictEqual(deleted.conversations, 1);
      assert.strictEqual(deleted.expenses, 1);
      assert.strictEqual(deleted.bookings, 1);
      assert.strictEqual(deleted.packingTemplates, 1);
      assert.strictEqual(deleted.disruptions, 1);
      assert.strictEqual(deleted.users, 1);

      for (const m of models) {
        const filter = deleteFilters.get(m.modelName);
        if (m.modelName === 'User') {
          assert.strictEqual(filter._id.toString(), testUserId.toString());
        } else {
          assert.strictEqual(filter.userId.toString(), testUserId.toString());
        }
      }
    } finally {
      for (const { model, count, deleteMany, deleteOne } of origMethods) {
        model.countDocuments = count;
        model.deleteMany = deleteMany;
        model.deleteOne = deleteOne;
      }
    }
  });
});

