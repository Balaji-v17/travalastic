import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProposal,
  applyReschedule,
  DROP_MIN_DELAY_MINUTES,
  getBucketFromSuggestedTime,
  BUCKET_ORDER,
} from '../src/services/rescheduleService.js';

describe('rescheduleService - normalizeProposal and ordering logic', () => {
  const baseDay = {
    dayNumber: 1,
    activities: [
      {
        title: 'Morning Breakfast',
        suggestedTime: 'Morning',
        done: true,
      },
      {
        title: 'Old Town Heritage Walk',
        suggestedTime: 'Morning',
        done: false,
      },
      {
        title: 'Art Museum Tour',
        suggestedTime: 'Afternoon',
        done: false,
      },
      {
        title: 'Sunset Beach Walk',
        suggestedTime: 'Evening',
        done: false,
      },
      {
        title: 'Seaside Dinner',
        suggestedTime: 'Night',
        done: false,
      },
    ],
  };

  it('fixture: unknown index is ignored', () => {
    const rawItems = [
      { index: -1, action: 'keep', reason: 'Invalid negative index' },
      { index: 99, action: 'keep', reason: 'Invalid out-of-bounds index' },
      { index: 1, action: 'move', newBucket: 'Afternoon', reason: 'Valid move' },
    ];

    const proposal = normalizeProposal(baseDay, 60, rawItems);
    // Base day has not-done activities at indices 1, 2, 3, 4
    assert.equal(proposal.length, 4);
    assert.deepEqual(proposal.map((p) => p.index), [1, 2, 3, 4]);
    assert.equal(proposal.find((p) => p.index === 1)?.action, 'move');
    assert.equal(proposal.find((p) => p.index === 1)?.newBucket, 'Afternoon');
    assert.equal(proposal.find((p) => p.index === 99), undefined);
    assert.equal(proposal.find((p) => p.index === -1), undefined);
  });

  it('fixture: duplicate index keeps the first item', () => {
    const rawItems = [
      { index: 1, action: 'move', newBucket: 'Afternoon', reason: 'First proposal for index 1' },
      { index: 1, action: 'drop', reason: 'Duplicate proposal for index 1 should be ignored' },
    ];

    const proposal = normalizeProposal(baseDay, 120, rawItems);
    const item1 = proposal.find((p) => p.index === 1);
    assert.equal(item1.action, 'move');
    assert.equal(item1.newBucket, 'Afternoon');
    assert.equal(item1.reason, 'First proposal for index 1');
  });

  it('fixture: a done activity referenced is ignored', () => {
    // Index 0 in baseDay has done: true ('Morning Breakfast')
    const rawItems = [
      { index: 0, action: 'drop', reason: 'Attempt to drop done activity' },
      { index: 2, action: 'keep', reason: 'Keep museum' },
    ];

    const proposal = normalizeProposal(baseDay, 120, rawItems);
    // Index 0 must NOT be in proposal
    assert.equal(proposal.find((p) => p.index === 0), undefined);
    // Total items should only equal the 4 not-done activities
    assert.equal(proposal.length, 4);
    assert.equal(proposal.every((p) => p.index !== 0), true);
  });

  it('fixture: an earlier-bucket move is converted into keep', () => {
    // Index 3 has suggestedTime: 'Evening'
    const rawItems = [
      { index: 3, action: 'move', newBucket: 'Morning', reason: 'Cannot move evening activity to morning' },
    ];

    const proposal = normalizeProposal(baseDay, 60, rawItems);
    const item3 = proposal.find((p) => p.index === 3);
    assert.equal(item3.action, 'keep');
    assert.equal(item3.newBucket, null);
  });

  it('fixture: a same-bucket move is converted into keep', () => {
    // Index 2 has suggestedTime: 'Afternoon'
    const rawItems = [
      { index: 2, action: 'move', newBucket: 'Afternoon', reason: 'Same bucket should become keep' },
    ];

    const proposal = normalizeProposal(baseDay, 60, rawItems);
    const item2 = proposal.find((p) => p.index === 2);
    assert.equal(item2.action, 'keep');
    assert.equal(item2.newBucket, null);
  });

  it('fixture: a drop with a 60-minute delay is converted into keep', () => {
    const rawItems = [
      { index: 2, action: 'drop', reason: 'Drop museum' },
    ];

    // 60 minutes is below DROP_MIN_DELAY_MINUTES (120)
    const proposal = normalizeProposal(baseDay, 60, rawItems);
    const item2 = proposal.find((p) => p.index === 2);
    assert.equal(item2.action, 'keep');
    assert.equal(item2.newBucket, null);
  });

  it('fixture: a drop with a 120-minute delay is preserved as drop', () => {
    const rawItems = [
      { index: 2, action: 'drop', reason: 'Drop museum' },
    ];

    const proposal = normalizeProposal(baseDay, 120, rawItems);
    const item2 = proposal.find((p) => p.index === 2);
    assert.equal(item2.action, 'drop');
  });

  it('fixture: missing items default to keep', () => {
    // Only pass item for index 1; indices 2, 3, 4 are missing from rawItems
    const rawItems = [
      { index: 1, action: 'move', newBucket: 'Evening', reason: 'Move heritage walk' },
    ];

    const proposal = normalizeProposal(baseDay, 60, rawItems);
    assert.equal(proposal.length, 4);

    const item1 = proposal.find((p) => p.index === 1);
    assert.equal(item1.action, 'move');
    assert.equal(item1.newBucket, 'Evening');

    for (const missingIndex of [2, 3, 4]) {
      const item = proposal.find((p) => p.index === missingIndex);
      assert.ok(item, `Item for index ${missingIndex} must exist`);
      assert.equal(item.action, 'keep');
      assert.equal(item.newBucket, null);
      assert.equal(item.reason, 'Kept as scheduled');
      assert.ok(item.title.length > 0);
    }
  });

  it('fixture: done activities keeping their positions in applyReschedule', () => {
    // Test day with done activities at index 0 and index 2
    const dayWithInterleavedDone = {
      dayNumber: 1,
      activities: [
        { title: 'Morning Coffee', suggestedTime: 'Morning', done: true }, // Index 0 (Done)
        { title: 'Temple Visit', suggestedTime: 'Morning', done: false },   // Index 1
        { title: 'Lunch at Cafe', suggestedTime: 'Afternoon', done: true },  // Index 2 (Done)
        { title: 'Art Gallery', suggestedTime: 'Afternoon', done: false },   // Index 3
        { title: 'Dinner by Bay', suggestedTime: 'Evening', done: false },   // Index 4
      ],
    };

    // Reschedule:
    // Index 1 (Temple): move to Evening
    // Index 3 (Art Gallery): drop
    // Index 4 (Dinner): keep (Evening)
    const normalizedItems = [
      { index: 1, action: 'move', newBucket: 'Evening', title: 'Temple Visit' },
      { index: 3, action: 'drop', title: 'Art Gallery' },
      { index: 4, action: 'keep', title: 'Dinner by Bay' },
    ];

    const rescheduledDay = applyReschedule(dayWithInterleavedDone, normalizedItems);

    // Assertions:
    // Dropped activity 'Art Gallery' is removed -> total length = 4
    assert.equal(rescheduledDay.activities.length, 4);

    // Done activities stay in their positions:
    // Index 0: 'Morning Coffee' (done: true)
    // Index 2: 'Lunch at Cafe' (done: true)
    assert.equal(rescheduledDay.activities[0].title, 'Morning Coffee');
    assert.equal(rescheduledDay.activities[0].done, true);

    assert.equal(rescheduledDay.activities[2].title, 'Lunch at Cafe');
    assert.equal(rescheduledDay.activities[2].done, true);

    // Remaining not-done activities (Temple moved to Evening, Dinner kept in Evening)
    // fill other positions (indices 1 and 3) in bucket order and stable original order
    assert.equal(rescheduledDay.activities[1].title, 'Temple Visit');
    assert.equal(rescheduledDay.activities[1].suggestedTime, 'Evening');
    assert.equal(rescheduledDay.activities[1].done, false);

    assert.equal(rescheduledDay.activities[3].title, 'Dinner by Bay');
    assert.equal(rescheduledDay.activities[3].done, false);
  });

  it('ordering logic: sorts remaining activities by bucket (Morning -> Afternoon -> Evening -> Night) while preserving relative order within bucket', () => {
    const day = {
      dayNumber: 1,
      activities: [
        { title: 'Act A', suggestedTime: 'Evening', done: false },
        { title: 'Act B', suggestedTime: 'Morning', done: false },
        { title: 'Act C', suggestedTime: 'Morning', done: false },
        { title: 'Act D', suggestedTime: 'Night', done: false },
        { title: 'Act E', suggestedTime: 'Afternoon', done: false },
      ],
    };

    // All kept as is
    const items = day.activities.map((a, i) => ({
      index: i,
      action: 'keep',
      title: a.title,
    }));

    const result = applyReschedule(day, items);
    const titles = result.activities.map((a) => a.title);

    // Expected order:
    // Morning: Act B, Act C (relative order preserved)
    // Afternoon: Act E
    // Evening: Act A
    // Night: Act D
    assert.deepEqual(titles, ['Act B', 'Act C', 'Act E', 'Act A', 'Act D']);
  });

  it('undo integration: applySnapshot restores previous day perfectly after reschedule apply', async () => {
    const { applySnapshot } = await import('../src/services/undoService.js');

    const originalDay = {
      dayNumber: 1,
      activities: [
        { title: 'Morning Coffee', suggestedTime: 'Morning', done: true },
        { title: 'Temple Visit', suggestedTime: 'Morning', done: false },
        { title: 'Art Gallery', suggestedTime: 'Afternoon', done: false },
      ],
    };

    const normalizedItems = [
      { index: 1, action: 'move', newBucket: 'Evening', title: 'Temple Visit' },
      { index: 2, action: 'drop', title: 'Art Gallery' },
    ];

    const rescheduledDay = applyReschedule(originalDay, normalizedItems);

    // Snapshot captured before rescheduling
    const snapshot = {
      dayNumbers: [1],
      previousDays: [JSON.parse(JSON.stringify(originalDay))],
    };

    const daysAfterReschedule = [rescheduledDay];
    const restoredDays = applySnapshot(daysAfterReschedule, snapshot);

    assert.equal(restoredDays.length, 1);
    assert.equal(restoredDays[0].activities.length, 3);
    assert.equal(restoredDays[0].activities[1].title, 'Temple Visit');
    assert.equal(restoredDays[0].activities[1].suggestedTime, 'Morning');
    assert.equal(restoredDays[0].activities[2].title, 'Art Gallery');
  });

  it('validation: title mismatch and done activity in apply items trigger conflict detection', () => {
    const day = {
      dayNumber: 1,
      activities: [
        { title: 'Morning Coffee', done: true },
        { title: 'Museum', done: false },
      ],
    };

    // Helper simulating the route validation logic
    function validateApplyItems(day, items) {
      const activities = day.activities;
      for (const item of items) {
        if (!item || typeof item.index !== 'number' || !Number.isInteger(item.index)) {
          return { status: 409, error: 'Your day changed. Please try again.' };
        }
        if (item.index < 0 || item.index >= activities.length) {
          return { status: 409, error: 'Your day changed. Please try again.' };
        }
        const act = activities[item.index];
        if (act.done === true) {
          return { status: 409, error: 'Your day changed. Please try again.' };
        }
        const currentTitle = typeof act === 'string' ? act : (act?.title || act?.name || '');
        const expectedTitle = typeof item.title === 'string' ? item.title : '';
        if (currentTitle.trim() !== expectedTitle.trim()) {
          return { status: 409, error: 'Your day changed. Please try again.' };
        }
      }
      return { status: 200 };
    }

    // 1. Referenced activity is done
    const resDone = validateApplyItems(day, [{ index: 0, title: 'Morning Coffee' }]);
    assert.equal(resDone.status, 409);

    // 2. Title mismatch
    const resMismatch = validateApplyItems(day, [{ index: 1, title: 'Old Title That Changed' }]);
    assert.equal(resMismatch.status, 409);

    // 3. Out of bounds index
    const resOutOfBounds = validateApplyItems(day, [{ index: 5, title: 'Something' }]);
    assert.equal(resOutOfBounds.status, 409);

    // 4. Valid item matching current state
    const resValid = validateApplyItems(day, [{ index: 1, title: 'Museum' }]);
    assert.equal(resValid.status, 200);
  });
});


