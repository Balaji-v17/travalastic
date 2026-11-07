import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveStatus,
  toJourney,
  NEUTRAL_PLACEHOLDER_IMAGE,
  type BackendSavedItinerary,
  type BackendBooking,
} from './journeyAdapter.ts';

test('deriveStatus: today before startDate -> planning', () => {
  const status = deriveStatus('2025-06-10', '2025-06-20', '2025-06-01');
  assert.equal(status, 'planning');
});

test('deriveStatus: today on startDate (inclusive start) -> in-travel', () => {
  const status = deriveStatus('2025-06-10', '2025-06-20', '2025-06-10');
  assert.equal(status, 'in-travel');
});

test('deriveStatus: today between start and end (mid) -> in-travel', () => {
  const status = deriveStatus('2025-06-10', '2025-06-20', '2025-06-15');
  assert.equal(status, 'in-travel');
});

test('deriveStatus: today on endDate (inclusive end) -> in-travel', () => {
  const status = deriveStatus('2025-06-10', '2025-06-20', '2025-06-20');
  assert.equal(status, 'in-travel');
});

test('deriveStatus: today after endDate -> completed', () => {
  const status = deriveStatus('2025-06-10', '2025-06-20', '2025-06-21');
  assert.equal(status, 'completed');
});

test('deriveStatus: missing startDate -> planning', () => {
  assert.equal(deriveStatus('', '2025-06-20', '2025-06-15'), 'planning');
  assert.equal(deriveStatus(null, '2025-06-20', '2025-06-15'), 'planning');
  assert.equal(deriveStatus(undefined, '2025-06-20', '2025-06-15'), 'planning');
});

test('deriveStatus: missing endDate -> planning', () => {
  assert.equal(deriveStatus('2025-06-10', '', '2025-06-15'), 'planning');
  assert.equal(deriveStatus('2025-06-10', null, '2025-06-15'), 'planning');
  assert.equal(deriveStatus('2025-06-10', undefined, '2025-06-15'), 'planning');
});

test('deriveStatus: missing both dates -> planning', () => {
  assert.equal(deriveStatus('', '', '2025-06-15'), 'planning');
  assert.equal(deriveStatus(null, null, '2025-06-15'), 'planning');
});

test('toJourney: converts backend saved itinerary into real Journey', () => {
  const raw: BackendSavedItinerary = {
    _id: '6720f1234567890abcdef123',
    userId: 'user_999',
    destination: 'Jaipur, Rajasthan',
    startDate: '2027-12-01',
    endDate: '2027-12-05',
    budgetEstimate: 45000,
    travelers: [{ name: 'A' }, { name: 'B' }],
    days: [
      {
        dayNumber: 1,
        accommodationSuggestion: 'Heritage Haveli',
        estimatedCostINR: 12000,
        activities: [
          {
            title: 'Amber Fort Visit',
            description: 'Historic hilltop fort.',
            suggestedTime: 'Morning',
            placeId: 'pl_amber',
          },
        ],
      },
    ],
  };

  const bookings: BackendBooking[] = [
    { _id: 'bk_flight_01', itineraryId: '6720f1234567890abcdef123', type: 'flight' },
  ];

  const journey = toJourney(raw, bookings, 'user_999');

  assert.equal(journey.id, '6720f1234567890abcdef123');
  assert.equal(journey.travelerId, 'user_999');
  assert.equal(journey.destination, 'Jaipur, Rajasthan');
  assert.equal(journey.title, ''); // Not invented from destination
  assert.equal(journey.startDate, '2027-12-01');
  assert.equal(journey.endDate, '2027-12-05');
  assert.equal(journey.travelers, 2);
  assert.equal(journey.totalSpend, 0);
  assert.equal(journey.totalBudget, 45000);
  assert.equal(journey.currency, 'INR');
  assert.equal(journey.imageUrl, NEUTRAL_PLACEHOLDER_IMAGE);
  assert.deepEqual(journey.bookings, ['bk_flight_01']);
  assert.deepEqual(journey.notifications, []);
  assert.deepEqual(journey.disruptions, []);

  // Itinerary
  assert.equal(journey.itinerary.length, 1);
  assert.equal(journey.itinerary[0].day, 1);
  assert.equal(journey.itinerary[0].date, '2027-12-01');
  assert.equal(journey.itinerary[0].activities.length, 1);
  assert.equal(journey.itinerary[0].activities[0].title, 'Amber Fort Visit');
  assert.equal(journey.itinerary[0].activities[0].status, 'unbooked');
});

test('toJourney: missing fields result in empty string/1 and no fabricated data', () => {
  const minimal: BackendSavedItinerary = {
    _id: 'itin_minimal',
  };

  const journey = toJourney(minimal, [], 'curr_user');

  assert.equal(journey.id, 'itin_minimal');
  assert.equal(journey.travelerId, 'curr_user');
  assert.equal(journey.destination, '');
  assert.equal(journey.title, '');
  assert.equal(journey.startDate, '');
  assert.equal(journey.endDate, '');
  assert.equal(journey.travelers, 1);
  assert.equal(journey.totalBudget, undefined);
  assert.equal(journey.totalSpend, 0);
  assert.equal(journey.status, 'planning');
  assert.deepEqual(journey.bookings, []);
  assert.deepEqual(journey.itinerary, []);
});
