import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { mergeDoneActivities } from '../src/services/agents/editNode.js';

describe('mergeDoneActivities', () => {
  it('fixture: one done at index 0', () => {
    const oldActivities = [
      { title: 'Morning Yoga', done: true, suggestedTime: 'Morning' },
      { title: 'Old Town Tour', done: false, suggestedTime: 'Afternoon' },
      { title: 'Cooking Class', done: false, suggestedTime: 'Evening' },
    ];
    const newActivities = [
      { title: 'Beach Volleyball', suggestedTime: 'Morning' },
      { title: 'Sunset Dinner Cruise', suggestedTime: 'Night' },
    ];

    const result = mergeDoneActivities(oldActivities, newActivities);

    assert.equal(result.length, 3);
    assert.equal(result[0].title, 'Morning Yoga');
    assert.equal(result[0].done, true);
    assert.equal(result[1].title, 'Beach Volleyball');
    assert.equal(result[2].title, 'Sunset Dinner Cruise');
  });

  it('fixture: a done activity in the middle', () => {
    const oldActivities = [
      { title: 'Breakfast', done: false, suggestedTime: 'Morning' },
      { title: 'Museum Visit', done: true, suggestedTime: 'Afternoon' },
      { title: 'Dinner', done: false, suggestedTime: 'Evening' },
    ];
    const newActivities = [
      { title: 'Sunrise Hike', suggestedTime: 'Morning' },
      { title: 'Night Market', suggestedTime: 'Night' },
    ];

    const result = mergeDoneActivities(oldActivities, newActivities);

    assert.equal(result.length, 3);
    assert.equal(result[0].title, 'Sunrise Hike');
    assert.equal(result[1].title, 'Museum Visit');
    assert.equal(result[1].done, true);
    assert.equal(result[2].title, 'Night Market');
  });

  it('fixture: several done activities', () => {
    const oldActivities = [
      { title: 'Breakfast at Cafe', done: true, suggestedTime: 'Morning' },
      { title: 'City Walk', done: false, suggestedTime: 'Morning' },
      { title: 'Art Gallery', done: true, suggestedTime: 'Afternoon' },
      { title: 'Coffee Break', done: false, suggestedTime: 'Evening' },
      { title: 'Rooftop Lounge', done: true, suggestedTime: 'Night' },
    ];
    const newActivities = [
      { title: 'Botanical Gardens', suggestedTime: 'Morning' },
      { title: 'Jazz Club', suggestedTime: 'Evening' },
    ];

    const result = mergeDoneActivities(oldActivities, newActivities);

    assert.equal(result.length, 5);
    assert.equal(result[0].title, 'Breakfast at Cafe');
    assert.equal(result[0].done, true);
    assert.equal(result[1].title, 'Botanical Gardens');
    assert.equal(result[2].title, 'Art Gallery');
    assert.equal(result[2].done, true);
    assert.equal(result[3].title, 'Jazz Club');
    assert.equal(result[4].title, 'Rooftop Lounge');
    assert.equal(result[4].done, true);
  });

  it('fixture: a duplicate title is dropped', () => {
    const oldActivities = [
      { title: 'Eiffel Tower Visit', done: true, suggestedTime: 'Morning' },
      { title: 'River Walk', done: false, suggestedTime: 'Afternoon' },
    ];
    const newActivities = [
      { title: '  eiffel tower visit  ', suggestedTime: 'Morning' }, // duplicate case-insensitive trimmed
      { title: 'Louvre Museum', suggestedTime: 'Afternoon' },
      { title: 'Seine Dinner', suggestedTime: 'Evening' },
    ];

    const result = mergeDoneActivities(oldActivities, newActivities);

    assert.equal(result.length, 3);
    assert.equal(result[0].title, 'Eiffel Tower Visit');
    assert.equal(result[0].done, true);
    assert.equal(result[1].title, 'Louvre Museum');
    assert.equal(result[2].title, 'Seine Dinner');
    // Ensure duplicate was completely dropped
    const duplicateInstances = result.filter(
      (a) => a.title.trim().toLowerCase() === 'eiffel tower visit'
    );
    assert.equal(duplicateInstances.length, 1);
  });

  it('fixture: a done index beyond the new length', () => {
    const oldActivities = [
      { title: 'Act 1', done: false },
      { title: 'Act 2', done: false },
      { title: 'Act 3', done: false },
      { title: 'Stargazing at Observatory', done: true, suggestedTime: 'Night' }, // orig index 3
    ];
    const newActivities = [
      { title: 'Morning Coffee Tour', suggestedTime: 'Morning' },
    ];

    // Total length = 1 done + 1 new = 2. Index 3 clamps to 1.
    const result = mergeDoneActivities(oldActivities, newActivities);

    assert.equal(result.length, 2);
    assert.equal(result[0].title, 'Morning Coffee Tour');
    assert.equal(result[1].title, 'Stargazing at Observatory');
    assert.equal(result[1].done, true);
  });

  it('fixture: check that done activities are deeply equal to the originals', () => {
    const originalDone = {
      _id: new mongoose.Types.ObjectId().toString(),
      title: 'Scuba Diving at Coral Reef',
      description: 'Two-tank guided dive including equipment and dive master',
      suggestedTime: 'Morning',
      placeId: 'place_grand_reef_01',
      location: {
        lat: 15.4989,
        lon: 73.8278,
        placeName: 'Grand Reef Marine Reserve',
      },
      done: true,
      customBookingRef: 'DIVE-98765',
    };

    const oldActivities = [
      originalDone,
      { title: 'Lunch at Beach Shack', done: false },
    ];

    const newActivities = [
      { title: 'Parasailing Adventure', suggestedTime: 'Afternoon' },
    ];

    const result = mergeDoneActivities(oldActivities, newActivities);

    assert.equal(result.length, 2);
    assert.deepStrictEqual(result[0], originalDone);
    // Purity: original object should not be mutated or referenced directly
    assert.notEqual(result[0], originalDone);
  });
});

