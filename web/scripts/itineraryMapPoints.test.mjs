import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  itineraryMapPoints,
  boundsOf,
  isValidCoordinate,
} from '../src/lib/itineraryMapPoints.ts';

describe('itineraryMapPoints', () => {
  it('handles empty or missing itinerary gracefully', () => {
    assert.deepEqual(itineraryMapPoints(null), { points: [], skipped: 0 });
    assert.deepEqual(itineraryMapPoints([]), { points: [], skipped: 0 });
    assert.deepEqual(itineraryMapPoints({ days: [] }), { points: [], skipped: 0 });
    assert.deepEqual(itineraryMapPoints({ itinerary: [] }), { points: [], skipped: 0 });
    assert.equal(boundsOf([]), null);
  });

  it('skips (0, 0) Null Island coordinates as invalid and increments skipped', () => {
    assert.equal(isValidCoordinate(0, 0), false);
    const itinerary = [
      {
        day: 1,
        items: [
          { title: 'Null Island Place', kind: 'place', location: { lat: 0, lon: 0 } },
        ],
      },
    ];
    const res = itineraryMapPoints(itinerary);
    assert.equal(res.points.length, 0);
    assert.equal(res.skipped, 1);
  });

  it('skips NaN, invalid strings, and out-of-range coordinates', () => {
    assert.equal(isValidCoordinate(NaN, 76.5), false);
    assert.equal(isValidCoordinate(95, 76.5), false); // Lat > 90
    assert.equal(isValidCoordinate(-95, 76.5), false); // Lat < -90
    assert.equal(isValidCoordinate(15.5, 195), false); // Lon > 180
    assert.equal(isValidCoordinate(15.5, -195), false); // Lon < -180

    const itinerary = [
      {
        day: 1,
        items: [
          { title: 'NaN Stop', kind: 'place', location: { lat: NaN, lon: 76.5 } },
          { title: 'Out of Range Stop', kind: 'place', location: { lat: 105.0, lon: 76.5 } },
          { title: 'Missing Coords Stop', kind: 'place' },
        ],
      },
    ];
    const res = itineraryMapPoints(itinerary);
    assert.equal(res.points.length, 0);
    assert.equal(res.skipped, 3);
  });

  it('keeps only activities with kind === "place"', () => {
    const itinerary = [
      {
        day: 1,
        items: [
          { title: 'Airport Flight', kind: 'transit', location: { lat: 8.73, lon: 76.71 } },
          { title: 'Local Eatery', kind: 'meal', location: { lat: 8.73, lon: 76.71 } },
          { title: 'Afternoon Rest', kind: 'rest', location: { lat: 8.73, lon: 76.71 } },
          { title: 'Varkala Beach', kind: 'place', location: { lat: 8.734, lon: 76.725 } },
        ],
      },
    ];
    const res = itineraryMapPoints(itinerary);
    assert.equal(res.points.length, 1);
    assert.equal(res.points[0].title, 'Varkala Beach');
    assert.equal(res.skipped, 0); // Non-places are ignored, not considered skipped places
  });

  it('assigns 1-indexed visit order per day and resets order on next day', () => {
    const itinerary = [
      {
        day: 1,
        items: [
          { title: 'Breakfast', kind: 'meal' },
          { title: 'Beach Walk', kind: 'place', location: { lat: 8.734, lon: 76.725 } },
          { title: 'Lunch', kind: 'meal' },
          { title: 'Cliff Viewpoint', kind: 'place', location: { lat: 8.739, lon: 76.702 } },
        ],
      },
      {
        day: 2,
        items: [
          { title: 'Temple Visit', kind: 'place', location: { lat: 8.732, lon: 76.706 } },
          { title: 'Missing Location Stop', kind: 'place', location: null },
          { title: 'Island Tour', kind: 'place', location: { lat: 8.698, lon: 76.747 } },
        ],
      },
    ];

    const res = itineraryMapPoints(itinerary);
    assert.equal(res.points.length, 4);
    assert.equal(res.skipped, 1);

    // Day 1
    assert.equal(res.points[0].day, 1);
    assert.equal(res.points[0].order, 1);
    assert.equal(res.points[0].title, 'Beach Walk');

    assert.equal(res.points[1].day, 1);
    assert.equal(res.points[1].order, 2);
    assert.equal(res.points[1].title, 'Cliff Viewpoint');

    // Day 2
    assert.equal(res.points[2].day, 2);
    assert.equal(res.points[2].order, 1);
    assert.equal(res.points[2].title, 'Temple Visit');

    assert.equal(res.points[3].day, 2);
    assert.equal(res.points[3].order, 2);
    assert.equal(res.points[3].title, 'Island Tour');
  });

  it('computes correct bounds for one point and multiple points', () => {
    const singlePoint = [{ day: 1, order: 1, title: 'Single Place', lat: 8.734, lon: 76.725 }];
    assert.deepEqual(boundsOf(singlePoint), [
      [8.734, 76.725],
      [8.734, 76.725],
    ]);

    const multiplePoints = [
      { day: 1, order: 1, title: 'Point A', lat: 8.7, lon: 76.5 },
      { day: 1, order: 2, title: 'Point B', lat: 9.2, lon: 77.1 },
      { day: 2, order: 1, title: 'Point C', lat: 8.4, lon: 76.9 },
    ];
    assert.deepEqual(boundsOf(multiplePoints), [
      [8.4, 76.5],
      [9.2, 77.1],
    ]);
  });
});
