import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applySnapshot, formatUndo } from '../src/services/undoService.js';

describe('undoService - applySnapshot', () => {
  const sampleDays = [
    {
      dayNumber: 1,
      estimatedCostINR: 1500,
      accommodationSuggestion: 'Seaside Resort',
      activities: [
        {
          title: 'Morning Beach Walk',
          placeId: 'place-101',
          location: { lat: 15.2993, lon: 74.124, placeName: 'Palolem Beach' },
          outdoor: true,
        },
      ],
    },
    {
      dayNumber: 2,
      estimatedCostINR: 2000,
      accommodationSuggestion: 'Seaside Resort',
      activities: [
        {
          title: 'Fort Aguada Visit',
          placeId: 'place-102',
          location: { lat: 15.492, lon: 73.773, placeName: 'Fort Aguada' },
          outdoor: true,
        },
      ],
    },
    {
      dayNumber: 3,
      estimatedCostINR: 1800,
      accommodationSuggestion: 'Seaside Resort',
      activities: [
        {
          title: 'Spice Plantation Tour',
          placeId: 'place-103',
          location: { lat: 15.405, lon: 74.025, placeName: 'Sahakari Spice Farm' },
          outdoor: true,
        },
      ],
    },
  ];

  it('1-day restore: restores the targeted day to its previous state while leaving other days intact', () => {
    // Simulate Day 2 having been edited:
    const editedDays = [
      sampleDays[0],
      {
        dayNumber: 2,
        estimatedCostINR: 5000,
        accommodationSuggestion: 'Luxury Casino Hotel',
        activities: [
          {
            title: 'Casino Royale Evening',
            placeId: 'place-999',
            location: { lat: 15.501, lon: 73.83, placeName: 'Deltin Royale' },
            outdoor: false,
          },
        ],
      },
      sampleDays[2],
    ];

    const snapshotEntry = {
      dayNumbers: [2],
      previousDays: [sampleDays[1]],
    };

    const restored = applySnapshot(editedDays, snapshotEntry);

    assert.equal(restored.length, 3);
    // Day 2 should now match original sampleDays[1]
    assert.deepEqual(restored[1], sampleDays[1]);
    assert.equal(restored[1].estimatedCostINR, 2000);
    assert.equal(restored[1].activities[0].placeId, 'place-102');
    assert.equal(restored[1].activities[0].title, 'Fort Aguada Visit');

    // Days 1 and 3 remain unchanged
    assert.deepEqual(restored[0], sampleDays[0]);
    assert.deepEqual(restored[2], sampleDays[2]);
  });

  it('2-day restore: restores multiple target days accurately', () => {
    const editedDays = [
      {
        dayNumber: 1,
        estimatedCostINR: 9000,
        activities: [{ title: 'Scuba Diving at Grand Island' }],
      },
      sampleDays[1],
      {
        dayNumber: 3,
        estimatedCostINR: 7500,
        activities: [{ title: 'Dudhsagar Waterfall Trek' }],
      },
    ];

    const snapshotEntry = {
      dayNumbers: [1, 3],
      previousDays: [sampleDays[0], sampleDays[2]],
    };

    const restored = applySnapshot(editedDays, snapshotEntry);

    assert.equal(restored.length, 3);
    assert.deepEqual(restored[0], sampleDays[0]);
    assert.deepEqual(restored[1], sampleDays[1]);
    assert.deepEqual(restored[2], sampleDays[2]);
  });

  it('preserves day order regardless of previousDays ordering in snapshot', () => {
    const editedDays = [
      { dayNumber: 1, activities: [{ title: 'Edited Day 1' }] },
      { dayNumber: 2, activities: [{ title: 'Edited Day 2' }] },
      { dayNumber: 3, activities: [{ title: 'Edited Day 3' }] },
    ];

    // previousDays provided in reverse order [Day 3, Day 1]
    const snapshotEntry = {
      dayNumbers: [1, 3],
      previousDays: [sampleDays[2], sampleDays[0]],
    };

    const restored = applySnapshot(editedDays, snapshotEntry);

    assert.equal(restored[0].dayNumber, 1);
    assert.equal(restored[1].dayNumber, 2);
    assert.equal(restored[2].dayNumber, 3);
    assert.deepEqual(restored[0], sampleDays[0]);
    assert.deepEqual(restored[2], sampleDays[2]);
  });

  it('keeps fields not touched by the edit (locations, placeIds, and outdoor flags) completely intact', () => {
    const editedDays = [
      sampleDays[0],
      {
        dayNumber: 2,
        estimatedCostINR: 3500,
        accommodationSuggestion: 'Seaside Resort',
        activities: [
          {
            title: 'Updated Kayaking Session',
            placeId: 'place-777',
            location: { lat: 15.3, lon: 74.0, placeName: 'River Sal' },
            outdoor: true,
          },
        ],
      },
      sampleDays[2],
    ];

    const snapshotEntry = {
      dayNumbers: [2],
      previousDays: [sampleDays[1]],
    };

    const restored = applySnapshot(editedDays, snapshotEntry);

    // Verify Day 1 retains exact coordinates and placeId
    assert.equal(restored[0].activities[0].placeId, 'place-101');
    assert.deepEqual(restored[0].activities[0].location, {
      lat: 15.2993,
      lon: 74.124,
      placeName: 'Palolem Beach',
    });
    assert.equal(restored[0].activities[0].outdoor, true);

    // Verify Day 3 retains exact coordinates and placeId
    assert.equal(restored[2].activities[0].placeId, 'place-103');
    assert.deepEqual(restored[2].activities[0].location, {
      lat: 15.405,
      lon: 74.025,
      placeName: 'Sahakari Spice Farm',
    });
    assert.equal(restored[2].activities[0].outdoor, true);

    // Verify Day 2 restored coordinates and placeId
    assert.equal(restored[1].activities[0].placeId, 'place-102');
    assert.deepEqual(restored[1].activities[0].location, {
      lat: 15.492,
      lon: 73.773,
      placeName: 'Fort Aguada',
    });
  });

  it('purity: does not mutate original input array or objects', () => {
    const originalInput = JSON.parse(JSON.stringify(sampleDays));
    const inputCopy = JSON.parse(JSON.stringify(sampleDays));

    const snapshotEntry = {
      dayNumbers: [2],
      previousDays: [
        {
          dayNumber: 2,
          estimatedCostINR: 9999,
          activities: [{ title: 'Old version' }],
        },
      ],
    };

    const result = applySnapshot(inputCopy, snapshotEntry);

    // original inputs remain untouched
    assert.deepEqual(inputCopy, originalInput);
    assert.notEqual(result, inputCopy);
    assert.equal(result[1].estimatedCostINR, 9999);
  });

  it('works with Mongoose subdocuments that define .toObject()', () => {
    const mockMongooseDays = sampleDays.map((d) => ({
      ...d,
      toObject: () => JSON.parse(JSON.stringify(d)),
    }));

    const mockSnapshot = {
      dayNumbers: [1],
      previousDays: [
        {
          ...sampleDays[0],
          estimatedCostINR: 1200,
          toObject: () => ({ ...sampleDays[0], estimatedCostINR: 1200 }),
        },
      ],
    };

    const restored = applySnapshot(mockMongooseDays, mockSnapshot);
    assert.equal(restored[0].estimatedCostINR, 1200);
    assert.equal(typeof restored[0].toObject, 'undefined'); // Cloned into plain object
  });

  it('handles empty or missing parameters gracefully', () => {
    assert.deepEqual(applySnapshot([], null), []);
    assert.deepEqual(applySnapshot(null, null), []);
    assert.deepEqual(applySnapshot(sampleDays, null), sampleDays);
    assert.deepEqual(applySnapshot(sampleDays, {}), sampleDays);
  });
});

describe('undoService - formatUndo', () => {
  it('formats edit history without leaking snapshot arrays or previousDays', () => {
    const editHistory = [
      {
        _id: '670000000000000000000001',
        dayNumbers: [1],
        previousDays: [{ dayNumber: 1, secret: 'leaked-data' }],
      },
      {
        _id: '670000000000000000000002',
        dayNumbers: [2, 3],
        previousDays: [{ dayNumber: 2 }, { dayNumber: 3 }],
      },
    ];

    const result = formatUndo(editHistory);

    assert.deepEqual(result, {
      count: 2,
      lastEditId: '670000000000000000000002',
      lastEditDays: [2, 3],
    });
    // Ensure previousDays is nowhere in the result
    assert.equal(result.previousDays, undefined);
    assert.equal(result.editHistory, undefined);
  });

  it('handles empty history gracefully', () => {
    assert.deepEqual(formatUndo([]), {
      count: 0,
      lastEditId: null,
      lastEditDays: [],
    });
    assert.deepEqual(formatUndo(null), {
      count: 0,
      lastEditId: null,
      lastEditDays: [],
    });
  });
});
