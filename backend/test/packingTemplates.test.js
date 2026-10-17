import { describe, it } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { mergeTemplateItems } from '../src/services/packingTemplateService.js';
import { countUserData, deleteUserAndData } from '../src/services/accountDeletion.js';
import PackingTemplate from '../src/models/PackingTemplate.js';
import Itinerary from '../src/models/Itinerary.js';
import Conversation from '../src/models/Conversation.js';
import Expense from '../src/models/Expense.js';
import Booking from '../src/models/Booking.js';
import User from '../src/models/User.js';

describe('packingTemplateService - mergeTemplateItems pure function', () => {
  it('fixture: case-insensitive duplicates are skipped', () => {
    const existingTexts = ['Sunscreen', 'Passport'];
    const templateItems = [
      { text: 'sunscreen', category: 'Toiletries' },
      { text: 'PASSPORT', category: 'Documents' },
      { text: 'Camera', category: 'Electronics' },
    ];
    const slotsLeft = 50;

    const result = mergeTemplateItems(existingTexts, templateItems, slotsLeft);
    assert.strictEqual(result.added, 1);
    assert.strictEqual(result.skippedDuplicates, 2);
    assert.strictEqual(result.skippedOverCap, 0);
    assert.strictEqual(result.itemsToAdd.length, 1);
    assert.strictEqual(result.itemsToAdd[0].text, 'Camera');
    assert.strictEqual(result.itemsToAdd[0].category, 'Electronics');
  });

  it('fixture: whitespace is trimmed and duplicate checks ignore extra spaces', () => {
    const existingTexts = ['  sunglasses  '];
    const templateItems = [
      { text: 'sunglasses', category: 'Accessories' },
      { text: '   swimsuit   ', category: 'Clothing' },
      { text: 'SWIMSUIT', category: 'Clothing' }, // internal duplicate
    ];
    const slotsLeft = 50;

    const result = mergeTemplateItems(existingTexts, templateItems, slotsLeft);
    assert.strictEqual(result.added, 1);
    assert.strictEqual(result.skippedDuplicates, 2);
    assert.strictEqual(result.skippedOverCap, 0);
    assert.strictEqual(result.itemsToAdd.length, 1);
    assert.strictEqual(result.itemsToAdd[0].text, 'swimsuit');
  });

  it('fixture: partial add at the cap', () => {
    const existingTexts = ['Item A'];
    const templateItems = [
      { text: 'Item B', category: 'My items' },
      { text: 'Item C', category: 'My items' },
      { text: 'Item D', category: 'My items' },
      { text: 'Item E', category: 'My items' },
    ];
    const slotsLeft = 2; // only 2 slots remaining before reaching the 50-item cap

    const result = mergeTemplateItems(existingTexts, templateItems, slotsLeft);
    assert.strictEqual(result.added, 2);
    assert.strictEqual(result.skippedDuplicates, 0);
    assert.strictEqual(result.skippedOverCap, 2);
    assert.strictEqual(result.itemsToAdd.length, 2);
    assert.deepStrictEqual(
      result.itemsToAdd.map((i) => i.text),
      ['Item B', 'Item C']
    );
  });

  it('fixture: category is preserved, defaults to "My items" if missing', () => {
    const existingTexts = [];
    const templateItems = [
      { text: 'Headphones', category: 'Electronics' },
      { text: 'Notebook' }, // missing category
      { text: 'Pen', category: '   ' }, // empty category
    ];
    const slotsLeft = 50;

    const result = mergeTemplateItems(existingTexts, templateItems, slotsLeft);
    assert.strictEqual(result.added, 3);
    assert.strictEqual(result.itemsToAdd[0].category, 'Electronics');
    assert.strictEqual(result.itemsToAdd[1].category, 'My items');
    assert.strictEqual(result.itemsToAdd[2].category, 'My items');
  });

  it('fixture: empty template produces zero counts', () => {
    const existingTexts = ['Passport', 'Wallet'];
    const templateItems = [];
    const slotsLeft = 50;

    const result = mergeTemplateItems(existingTexts, templateItems, slotsLeft);
    assert.strictEqual(result.added, 0);
    assert.strictEqual(result.skippedDuplicates, 0);
    assert.strictEqual(result.skippedOverCap, 0);
    assert.deepStrictEqual(result.itemsToAdd, []);
  });
});

describe('accountDeletion - PackingTemplate removal verification', () => {
  it('proves PackingTemplate is counted and deleted during account deletion', async () => {
    const testUserId = new mongoose.Types.ObjectId();

    // Verify PackingTemplate model has userId index and schema fields
    const templateDoc = new PackingTemplate({
      userId: testUserId,
      name: 'Summer Trip',
      items: [
        { text: 'Beach towel', category: 'Beach' },
        { text: 'Sun hat', category: 'Clothing' },
      ],
    });
    assert.strictEqual(templateDoc.name, 'Summer Trip');
    assert.strictEqual(templateDoc.items.length, 2);
    assert.strictEqual(templateDoc.userId.toString(), testUserId.toString());

    // Stub all models called by countUserData and deleteUserAndData
    const models = [Itinerary, Conversation, Expense, Booking, PackingTemplate, User];
    const origMethods = models.map((m) => ({
      model: m,
      count: m.countDocuments,
      deleteMany: m.deleteMany,
      deleteOne: m.deleteOne,
    }));

    let templateCountFilter = null;
    let templateDeleteFilter = null;

    for (const m of models) {
      m.countDocuments = async (filter) => {
        if (m === PackingTemplate) templateCountFilter = filter;
        return m === PackingTemplate ? 5 : 1;
      };
      m.deleteMany = async (filter) => {
        if (m === PackingTemplate) templateDeleteFilter = filter;
        return { deletedCount: m === PackingTemplate ? 5 : 1 };
      };
      m.deleteOne = async () => ({ deletedCount: 1 });
    }

    try {
      const counts = await countUserData(testUserId);
      assert.strictEqual(counts.packingTemplates, 5);
      assert.deepStrictEqual(templateCountFilter, { userId: testUserId });

      const deleted = await deleteUserAndData(testUserId);
      assert.strictEqual(deleted.packingTemplates, 5);
      assert.deepStrictEqual(templateDeleteFilter, { userId: testUserId });
    } finally {
      for (const { model, count, deleteMany, deleteOne } of origMethods) {
        model.countDocuments = count;
        model.deleteMany = deleteMany;
        model.deleteOne = deleteOne;
      }
    }
  });
});

