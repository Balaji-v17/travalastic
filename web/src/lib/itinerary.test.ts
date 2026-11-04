import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRawRequest, type JourneyDNA } from './itineraryApi.ts';
import {
  toGeneratedJourney,
  PAISE_PER_RUPEE,
  paiseToRupees,
} from './itineraryAdapter.ts';

test('buildRawRequest formats a natural language brief containing all DNA fields', () => {
  const dna: JourneyDNA = {
    destination: 'Kyoto, Japan',
    destinationId: 'kyoto',
    origin: 'Bengaluru',
    startDate: '2025-04-10',
    nights: 5,
    travelers: 2,
    budget: 250000,
    pace: 'relaxed',
    comfort: 'premium',
    interests: ['Culture', 'Food'],
    mustHave: 'Tea ceremony, bamboo forest',
    avoid: 'Early mornings',
    notes: 'Celebrating anniversary',
  };

  const raw = buildRawRequest(dna);

  assert.ok(raw.includes('Kyoto, Japan'));
  assert.ok(raw.includes('Bengaluru'));
  assert.ok(raw.includes('5-day'));
  assert.ok(raw.includes('2 travelers'));
  assert.ok(raw.includes('₹250,000'));
  assert.ok(raw.includes('relaxed'));
  assert.ok(raw.includes('premium'));
  assert.ok(raw.includes('Culture, Food'));
  assert.ok(raw.includes('Tea ceremony, bamboo forest'));
  assert.ok(raw.includes('Early mornings'));
  assert.ok(raw.includes('Celebrating anniversary'));
});

test('buildRawRequest returns empty string when nights <= 0 to trigger backend 400 validation', () => {
  const dna: JourneyDNA = {
    destination: 'Paris, France',
    destinationId: 'paris',
    origin: 'Mumbai',
    startDate: '2025-05-01',
    nights: 0,
    travelers: 1,
    budget: 100000,
    pace: 'balanced',
    comfort: 'smart',
    interests: [],
    mustHave: '',
    avoid: '',
    notes: '',
  };

  const raw = buildRawRequest(dna);
  assert.equal(raw, '');
});

test('buildRawRequest returns empty string when destination is empty', () => {
  const dna: JourneyDNA = {
    destination: '   ',
    destinationId: '',
    origin: 'Mumbai',
    startDate: '2025-05-01',
    nights: 4,
    travelers: 1,
    budget: 100000,
    pace: 'balanced',
    comfort: 'smart',
    interests: [],
    mustHave: '',
    avoid: '',
    notes: '',
  };

  assert.equal(buildRawRequest(dna), '');
});

test('PAISE_PER_RUPEE constant is 100 and paiseToRupees converts accurately', () => {
  assert.equal(PAISE_PER_RUPEE, 100);
  assert.equal(paiseToRupees(1500000), 15000);
  assert.equal(paiseToRupees(99), 1);
  assert.equal(paiseToRupees(0), 0);
});

test('toGeneratedJourney adapts backend response with only real fields and no mock IDs', () => {
  const mockBackendResponse = {
    itineraryId: 'itin_67890abcdef',
    itinerary: [
      {
        dayNumber: 1,
        accommodationSuggestion: 'Heritage Haveli near Lake Pichola',
        estimatedCostINR: 12500,
        activities: [
          {
            title: 'City Palace Complex Tour',
            name: 'City Palace Complex Tour',
            description: 'Explore the monumental palace and courtyard overlooking the lake.',
            suggestedTime: 'Morning',
            placeId: 'pl_101',
            location: { lat: 24.5764, lon: 73.6835, placeName: 'City Palace' },
            outdoor: false,
          },
          {
            title: 'Sunset Boat Cruise on Lake Pichola',
            name: 'Sunset Boat Cruise on Lake Pichola',
            description: 'Scenic cruise passing Jag Mandir.',
            suggestedTime: 'Evening',
            placeId: 'pl_102',
            location: { lat: 24.575, lon: 73.68, placeName: 'Lake Pichola' },
            outdoor: true,
          },
        ],
      },
      {
        dayNumber: 2,
        accommodationSuggestion: 'Heritage Haveli near Lake Pichola',
        estimatedCostINR: 8500,
        activities: [
          {
            title: 'Jagdish Temple & Old City Walk',
            name: 'Jagdish Temple & Old City Walk',
            description: 'Visit the historic 1651 temple and wander through spice bazaars.',
            suggestedTime: '10:00',
            placeId: 'pl_103',
            location: null,
            outdoor: true,
          },
        ],
      },
    ],
  };

  const dna: JourneyDNA = {
    destination: 'Udaipur, Rajasthan',
    destinationId: 'udaipur',
    origin: 'Delhi',
    startDate: '2025-11-15',
    nights: 2,
    travelers: 2,
    budget: 50000,
    pace: 'relaxed',
    comfort: 'comfortable',
    interests: ['History', 'Photography'],
    mustHave: '',
    avoid: '',
    notes: '',
  };

  const journey = toGeneratedJourney(mockBackendResponse, dna);

  // Persistence ID
  assert.equal(journey.itineraryId, 'itin_67890abcdef');
  assert.equal(journey.savedJourneyId, 'itin_67890abcdef');

  // Title and route
  assert.equal(journey.title, '2 Days in Udaipur');
  assert.deepEqual(journey.route, ['Delhi', 'Udaipur']);

  // Days count and dates
  assert.equal(journey.days.length, 2);
  assert.equal(journey.days[0].date, '2025-11-15');
  assert.equal(journey.days[1].date, '2025-11-16');

  // Real accommodation suggestion from backend
  assert.equal(journey.days[0].accommodationSuggestion, 'Heritage Haveli near Lake Pichola');
  assert.ok(journey.days[0].title.includes('Heritage Haveli near Lake Pichola'));

  // Day 1 activities: word-based suggestedTime is preserved
  assert.equal(journey.days[0].items.length, 2);
  const act1 = journey.days[0].items[0];
  assert.equal(act1.title, 'City Palace Complex Tour');
  assert.equal(act1.time, 'Morning'); // preserved word
  assert.equal(act1.type, 'activity');
  assert.equal(act1.costKnown, false); // no mock cost
  assert.equal(act1.cost, 0);
  assert.equal(act1.entityId, undefined); // no mock entity IDs
  assert.equal(act1.entityType, undefined);
  assert.equal(act1.note, 'Explore the monumental palace and courtyard overlooking the lake.');

  // Day 2 activity: clock time preserved
  const act3 = journey.days[1].items[0];
  assert.equal(act3.time, '10:00');
  assert.equal(act3.costKnown, false);

  // Real estimated total: 12500 + 8500 = 21000
  assert.equal(journey.budget.total, 21000);
});
