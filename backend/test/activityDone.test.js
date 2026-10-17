import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Itinerary from '../src/models/Itinerary.js';

describe('Itinerary Schema - Activity done field', () => {
  it('defaults done to false when an activity is created without done field', () => {
    const itinerary = new Itinerary({
      userId: new mongoose.Types.ObjectId(),
      destination: 'Goa',
      days: [
        {
          dayNumber: 1,
          activities: [
            {
              title: 'Morning Yoga',
              placeId: 'p-1',
            },
          ],
        },
      ],
    });

    const day = itinerary.days[0];
    const activity = day.activities[0];
    assert.equal(activity.done, false);

    const doc = itinerary.toObject();
    assert.equal(doc.days[0].activities[0].done, false);
  });

  it('preserves done: true and does not silently drop it', () => {
    const itinerary = new Itinerary({
      userId: new mongoose.Types.ObjectId(),
      destination: 'Goa',
      days: [
        {
          dayNumber: 1,
          activities: [
            {
              title: 'Scuba Diving',
              done: true,
            },
          ],
        },
      ],
    });

    const doc = itinerary.toObject();
    assert.equal(doc.days[0].activities[0].done, true);
  });

  it('treats existing activities without done field as not done', () => {
    // Simulating loading raw doc from DB that was saved prior to this feature
    const rawDocFromDb = {
      _id: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      days: [
        {
          dayNumber: 1,
          activities: [
            {
              title: 'Old Legacy Activity',
              placeId: 'legacy-1',
            },
          ],
        },
      ],
    };

    const hydrated = Itinerary.hydrate(rawDocFromDb);
    assert.equal(hydrated.days[0].activities[0].done, false);
    const serialized = hydrated.toObject();
    assert.equal(serialized.days[0].activities[0].done, false);
  });
});

