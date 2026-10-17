import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { applyOrder } from '../src/services/reorderService.js';

describe('reorderService - applyOrder pure function', () => {
  it('fixture: a simple swap', () => {
    const activities = [
      { title: 'Morning Breakfast', suggestedTime: 'Morning', description: 'Eat food' },
      { title: 'Beach Walk', suggestedTime: 'Afternoon', description: 'Walk on beach' },
    ];
    const order = [1, 0];

    const result = applyOrder(activities, order);

    assert.equal(result.length, 2);
    assert.equal(result[0].title, 'Beach Walk');
    assert.equal(result[0].suggestedTime, 'Morning'); // Label belongs to position 0
    assert.equal(result[1].title, 'Morning Breakfast');
    assert.equal(result[1].suggestedTime, 'Afternoon'); // Label belongs to position 1
  });

  it('fixture: a done activity staying fixed', () => {
    const activities = [
      { title: 'Completed Dive', done: true, suggestedTime: 'Morning' },
      { title: 'Market Shopping', done: false, suggestedTime: 'Afternoon' },
      { title: 'Sunset Dinner', done: false, suggestedTime: 'Evening' },
    ];
    const validOrder = [0, 2, 1];

    const result = applyOrder(activities, validOrder);

    assert.equal(result.length, 3);
    assert.equal(result[0].title, 'Completed Dive');
    assert.equal(result[0].done, true);
    assert.equal(result[0].suggestedTime, 'Morning');
    assert.equal(result[1].title, 'Sunset Dinner');
    assert.equal(result[1].suggestedTime, 'Afternoon');
    assert.equal(result[2].title, 'Market Shopping');
    assert.equal(result[2].suggestedTime, 'Evening');

    // Attempting to move the done activity to index 1 must throw
    const invalidOrder = [1, 0, 2];
    assert.throws(
      () => applyOrder(activities, invalidOrder),
      /done activity.*cannot be moved/i
    );
  });

  it('fixture: an invalid permutation', () => {
    const activities = [
      { title: 'Act 1' },
      { title: 'Act 2' },
      { title: 'Act 3' },
    ];

    // Wrong length
    assert.throws(() => applyOrder(activities, [0, 1]), /length/i);
    // Duplicate index
    assert.throws(() => applyOrder(activities, [0, 0, 1]), /duplicate/i);
    // Out-of-bounds index
    assert.throws(() => applyOrder(activities, [0, 1, 3]), /invalid index/i);
    // Negative index
    assert.throws(() => applyOrder(activities, [-1, 1, 2]), /invalid index/i);
    // Non-array input
    assert.throws(() => applyOrder(activities, '0,1,2'), /must be an array/i);
    assert.throws(() => applyOrder(null, [0, 1, 2]), /must be an array/i);
  });

  it('fixture: labels staying with positions', () => {
    const activities = [
      { title: 'Activity A', suggestedTime: '9:00 AM' },
      { title: 'Activity B', suggestedTime: '1:00 PM' },
      { title: 'Activity C', suggestedTime: '6:00 PM' },
    ];
    const order = [2, 0, 1]; // C -> 0, A -> 1, B -> 2

    const result = applyOrder(activities, order);

    assert.equal(result[0].title, 'Activity C');
    assert.equal(result[0].suggestedTime, '9:00 AM');
    assert.equal(result[1].title, 'Activity A');
    assert.equal(result[1].suggestedTime, '1:00 PM');
    assert.equal(result[2].title, 'Activity B');
    assert.equal(result[2].suggestedTime, '6:00 PM');
  });

  it('fixture: a position with no suggestedTime', () => {
    const activities = [
      { title: 'Activity A', suggestedTime: 'Morning' },
      { title: 'Activity B' }, // no suggestedTime at position 1
    ];
    const order = [1, 0];

    const result = applyOrder(activities, order);

    // Position 0 had 'Morning', so Activity B gets 'Morning'
    assert.equal(result[0].title, 'Activity B');
    assert.equal(result[0].suggestedTime, 'Morning');

    // Position 1 had no suggestedTime, so Activity A leaves it unset
    assert.equal(result[1].title, 'Activity A');
    assert.equal(result[1].suggestedTime, undefined);
    assert.equal('suggestedTime' in result[1], false);
  });

  it('fixture: a check that moved activities are deeply equal to the originals apart from suggestedTime', () => {
    const originalActivity = {
      _id: new mongoose.Types.ObjectId().toString(),
      title: 'Louvre Museum Tour',
      name: 'Louvre Museum Tour',
      description: 'Comprehensive guided exploration of the Denon wing',
      suggestedTime: 'Afternoon',
      placeId: 'place_louvre_123',
      location: {
        lat: 48.8606,
        lon: 2.3376,
        placeName: 'Musée du Louvre',
      },
      outdoor: false,
      done: false,
      customMetadata: 'keep_unmodified',
    };

    const activities = [
      { title: 'Morning Coffee', suggestedTime: 'Morning' },
      originalActivity,
    ];

    const order = [1, 0];
    const result = applyOrder(activities, order);

    // Position 0 now has Louvre, with suggestedTime: 'Morning'
    const moved = result[0];
    assert.equal(moved.suggestedTime, 'Morning');

    // Strip suggestedTime from both and assert deep strict equality
    const { suggestedTime: _t1, ...movedWithoutTime } = moved;
    const { suggestedTime: _t2, ...originalWithoutTime } = originalActivity;
    assert.deepStrictEqual(movedWithoutTime, originalWithoutTime);

    // Purity check: ensure not the exact same object reference
    assert.notEqual(moved, originalActivity);
  });

  it('validation and conflict: detects title mismatch and done activity movement', () => {
    const activities = [
      { title: 'Morning Coffee', done: true, suggestedTime: 'Morning' },
      { title: 'Museum Tour', done: false, suggestedTime: 'Afternoon' },
      { title: 'Dinner Cruise', done: false, suggestedTime: 'Evening' },
    ];

    // Helper imitating endpoint validation
    function validateReorderRequest({ dayNumber, order, expectedTitles }) {
      if (typeof dayNumber !== 'number' || dayNumber < 1) {
        return { status: 400, error: 'dayNumber is not within this trip' };
      }
      if (!Array.isArray(order) || order.length !== activities.length) {
        return { status: 400, error: `order must be an array of length ${activities.length}` };
      }
      if (!Array.isArray(expectedTitles) || expectedTitles.length !== activities.length) {
        return { status: 400, error: `expectedTitles must be an array of length ${activities.length}` };
      }

      // Check applyOrder
      try {
        applyOrder(activities, order);
      } catch (err) {
        return { status: 400, error: err.message };
      }

      // Check expectedTitles
      for (let i = 0; i < activities.length; i++) {
        if (expectedTitles[i] !== activities[i].title) {
          return { status: 409, error: 'This day changed. Please reopen it.' };
        }
      }

      return { status: 200 };
    }

    // 1. Valid reordering request
    const validRes = validateReorderRequest({
      dayNumber: 1,
      order: [0, 2, 1],
      expectedTitles: ['Morning Coffee', 'Museum Tour', 'Dinner Cruise'],
    });
    assert.equal(validRes.status, 200);

    // 2. Title mismatch -> 409 "This day changed. Please reopen it."
    const mismatchRes = validateReorderRequest({
      dayNumber: 1,
      order: [0, 2, 1],
      expectedTitles: ['Morning Coffee', 'Old Museum Name', 'Dinner Cruise'],
    });
    assert.equal(mismatchRes.status, 409);
    assert.equal(mismatchRes.error, 'This day changed. Please reopen it.');

    // 3. Attempting to move done activity -> 400
    const moveDoneRes = validateReorderRequest({
      dayNumber: 1,
      order: [1, 0, 2],
      expectedTitles: ['Morning Coffee', 'Museum Tour', 'Dinner Cruise'],
    });
    assert.equal(moveDoneRes.status, 400);

    // 4. Invalid dayNumber -> 400
    const invalidDayRes = validateReorderRequest({
      dayNumber: -1,
      order: [0, 2, 1],
      expectedTitles: ['Morning Coffee', 'Museum Tour', 'Dinner Cruise'],
    });
    assert.equal(invalidDayRes.status, 400);
  });
});
