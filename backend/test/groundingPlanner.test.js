import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndGroundItinerary,
  sanitizeMealActivity,
} from '../src/services/ai/composerNode.js';

describe('Planner Grounding & Validation', () => {
  const sampleCandidates = [
    {
      id: 'tp_varkala_beach',
      name: 'Varkala Beach',
      type: 'beach',
      lat: 8.7379,
      lon: 76.7032,
      source: 'tourist_places',
    },
    {
      id: 'tp_janardhana_swami',
      name: 'Janardhana Swami Temple',
      type: 'temple',
      lat: 8.7344,
      lon: 76.7118,
      source: 'tourist_places',
    },
    {
      id: 'ov_sivagiri_mutt',
      name: 'Sivagiri Mutt',
      type: 'attraction',
      lat: 8.7511,
      lon: 76.7289,
      source: 'overpass',
    },
    {
      id: 'ov_varkala_cliff',
      name: 'Varkala Cliff',
      type: 'viewpoint',
      lat: 8.7391,
      lon: 76.7025,
      source: 'overpass',
    },
  ];

  it('copies coordinates directly from candidate record', () => {
    const rawDays = [
      {
        dayNumber: 1,
        theme: 'Cliff and Beach',
        activities: [
          {
            title: 'Relax at Varkala Beach',
            description: 'Golden sands and Arabian sea.',
            timeOfDay: 'Morning',
            kind: 'place',
            placeRef: 'tp_varkala_beach',
          },
        ],
        accommodationSuggestion: 'Cliffside Resort',
        estimatedCostINR: 3500,
      },
    ];

    const { days } = validateAndGroundItinerary(rawDays, sampleCandidates, { pace: 'balanced' });
    const act = days[0].activities[0];
    assert.equal(act.kind, 'place');
    assert.equal(act.placeRef, 'tp_varkala_beach');
    assert.deepEqual(act.location, {
      lat: 8.7379,
      lon: 76.7032,
      placeName: 'Varkala Beach',
    });
  });

  it('rejects hallucinated placeRef and converts to Free time (rest)', () => {
    const rawDays = [
      {
        dayNumber: 1,
        theme: 'Discovery',
        activities: [
          {
            title: 'Visit Imaginary Water Park',
            description: 'Non-existent park in Varkala.',
            timeOfDay: 'Morning',
            kind: 'place',
            placeRef: 'hallucinated_ref_999',
          },
        ],
        accommodationSuggestion: 'Mid-range Hotel',
        estimatedCostINR: 2500,
      },
    ];

    const { days } = validateAndGroundItinerary(rawDays, sampleCandidates, { pace: 'balanced' });
    const act = days[0].activities[0];
    assert.equal(act.kind, 'rest');
    assert.equal(act.title, 'Free time');
    assert.equal(act.placeRef, null);
    assert.equal(act.location, null);
  });

  it('repairs valid candidate name when placeRef ID was mismatched or fuzzy', () => {
    const rawDays = [
      {
        dayNumber: 1,
        theme: 'Temple Visit',
        activities: [
          {
            title: 'Janardhana Swami Temple Exploration',
            description: 'Ancient temple visit.',
            timeOfDay: 'Morning',
            kind: 'place',
            placeRef: 'wrong_id',
          },
        ],
        accommodationSuggestion: 'Mid-range Hotel',
        estimatedCostINR: 2500,
      },
    ];

    const { days } = validateAndGroundItinerary(rawDays, sampleCandidates, { pace: 'balanced' });
    const act = days[0].activities[0];
    assert.equal(act.kind, 'place');
    assert.equal(act.placeRef, 'tp_janardhana_swami');
    assert.equal(act.location.lat, 8.7344);
  });

  it('enforces pace limits and converts excess places to rest', () => {
    const rawDays = [
      {
        dayNumber: 1,
        theme: 'Action Packed',
        activities: [
          { title: 'Place 1', timeOfDay: 'Morning', kind: 'place', placeRef: 'tp_varkala_beach' },
          { title: 'Place 2', timeOfDay: 'Midday', kind: 'place', placeRef: 'tp_janardhana_swami' },
          { title: 'Place 3', timeOfDay: 'Afternoon', kind: 'place', placeRef: 'ov_sivagiri_mutt' },
          { title: 'Place 4', timeOfDay: 'Evening', kind: 'place', placeRef: 'ov_varkala_cliff' },
        ],
        accommodationSuggestion: 'Resort',
        estimatedCostINR: 3000,
      },
    ];

    // For balanced pace: max 3 places/day; 4th place must become rest
    const { days } = validateAndGroundItinerary(rawDays, sampleCandidates, { pace: 'balanced' });
    assert.equal(days[0].activities[0].kind, 'place');
    assert.equal(days[0].activities[1].kind, 'place');
    assert.equal(days[0].activities[2].kind, 'place');
    assert.equal(days[0].activities[3].kind, 'rest');
    assert.equal(days[0].activities[3].title, 'Free time');
  });

  it('sanitizes meal activities naming specific restaurants and prices', () => {
    const act1 = sanitizeMealActivity({
      title: 'Lunch at Cafe Del Mar Restaurant',
      description: 'Enjoy seafood for ₹850 from 12 PM - 3 PM.',
    });
    assert.equal(act1.title, 'Lunch at a local eatery');
    assert.ok(!act1.description.includes('₹850'));
    assert.ok(!act1.description.includes('12 PM - 3 PM'));

    const act2 = sanitizeMealActivity({
      title: 'Dinner at Fisherman\'s Cove',
      description: 'Fresh catch of the day.',
    });
    assert.equal(act2.title, 'Dinner at a local eatery');
  });

  it('sets last day accommodationSuggestion to null and estimatedCostINR to 0', () => {
    const rawDays = [
      {
        dayNumber: 1,
        theme: 'Day 1',
        activities: [
          { title: 'Varkala Beach', timeOfDay: 'Morning', kind: 'place', placeRef: 'tp_varkala_beach' },
        ],
        accommodationSuggestion: 'Cliff Hotel',
        estimatedCostINR: 4000,
      },
      {
        dayNumber: 2,
        theme: 'Day 2',
        activities: [
          { title: 'Sivagiri Mutt', timeOfDay: 'Morning', kind: 'place', placeRef: 'ov_sivagiri_mutt' },
        ],
        accommodationSuggestion: 'Cliff Hotel',
        estimatedCostINR: 4000,
      },
      {
        dayNumber: 3,
        theme: 'Day 3',
        activities: [
          { title: 'Departure', timeOfDay: 'Morning', kind: 'transit', placeRef: null },
        ],
        accommodationSuggestion: 'Cliff Hotel',
        estimatedCostINR: 4000,
      },
    ];

    const { days } = validateAndGroundItinerary(rawDays, sampleCandidates, { pace: 'balanced' });
    assert.equal(days[0].accommodationSuggestion, 'Cliff Hotel');
    assert.equal(days[0].estimatedCostINR, 4000);
    assert.equal(days[1].accommodationSuggestion, 'Cliff Hotel');
    assert.equal(days[1].estimatedCostINR, 4000);
    // Departure day (day 3 of 3):
    assert.equal(days[2].accommodationSuggestion, null);
    assert.equal(days[2].estimatedCostINR, 0);
  });

  it('marks grounding limited: true when fewer than 5 distinct candidates are used', () => {
    const rawDays = [
      {
        dayNumber: 1,
        theme: 'Beach',
        activities: [
          { title: 'Varkala Beach', timeOfDay: 'Morning', kind: 'place', placeRef: 'tp_varkala_beach' },
          { title: 'Janardhana Swami Temple', timeOfDay: 'Afternoon', kind: 'place', placeRef: 'tp_janardhana_swami' },
        ],
        accommodationSuggestion: 'Resort',
        estimatedCostINR: 3000,
      },
    ];

    const { grounding } = validateAndGroundItinerary(rawDays, sampleCandidates, { pace: 'balanced' });
    assert.equal(grounding.candidateCount, 4);
    assert.equal(grounding.limited, true);
    assert.equal(grounding.distinctUsedCount, 2);
  });
});

