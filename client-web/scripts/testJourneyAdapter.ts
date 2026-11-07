import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveStatus,
  toJourney,
  NEUTRAL_PLACEHOLDER_IMAGE,
  type BackendSavedItinerary,
  type BackendBooking,
} from '../src/lib/journeyAdapter.ts';

test('1. Before startDate: planning', () => {
  assert.equal(deriveStatus('2025-07-10', '2025-07-20', '2025-07-01'), 'planning');
});

test('2. Start date (inclusive): in-travel', () => {
  assert.equal(deriveStatus('2025-07-10', '2025-07-20', '2025-07-10'), 'in-travel');
});

test('3. Mid date: in-travel', () => {
  assert.equal(deriveStatus('2025-07-10', '2025-07-20', '2025-07-15'), 'in-travel');
});

test('4. End date (inclusive): in-travel', () => {
  assert.equal(deriveStatus('2025-07-10', '2025-07-20', '2025-07-20'), 'in-travel');
});

test('5. After endDate: completed', () => {
  assert.equal(deriveStatus('2025-07-10', '2025-07-20', '2025-07-21'), 'completed');
});

test('6. Missing startDate -> planning', () => {
  assert.equal(deriveStatus('', '2025-07-20', '2025-07-15'), 'planning');
});

test('7. Missing endDate -> planning', () => {
  assert.equal(deriveStatus('2025-07-10', '', '2025-07-15'), 'planning');
});

test('8. Missing both dates -> planning', () => {
  assert.equal(deriveStatus('', '', '2025-07-15'), 'planning');
});

test('9. toJourney preserves real fields and attaches matching bookings', () => {
  const mockItinerary: BackendSavedItinerary = {
    _id: 'itin_12345',
    userId: 'user_abc',
    destination: 'Goa, India',
    startDate: '2027-08-01',
    endDate: '2027-08-05',
    budgetEstimate: 30000,
    travelers: 2,
    days: [
      {
        dayNumber: 1,
        accommodationSuggestion: 'Beach Resort',
        estimatedCostINR: 6000,
        activities: [
          {
            title: 'Anjuna Beach Sunset',
            description: 'Relax by the sea.',
            suggestedTime: 'Evening',
            placeId: 'pl_anjuna',
          },
        ],
      },
    ],
  };

  const mockBookings: BackendBooking[] = [
    { _id: 'bk_goa_01', itineraryId: 'itin_12345', type: 'flight' },
  ];

  const j = toJourney(mockItinerary, mockBookings, 'user_abc');

  assert.equal(j.id, 'itin_12345');
  assert.equal(j.destination, 'Goa, India');
  assert.equal(j.totalBudget, 30000);
  assert.equal(j.travelers, 2);
  assert.equal(j.status, 'planning');
  assert.deepEqual(j.bookings, ['bk_goa_01']);
  assert.equal(j.imageUrl, NEUTRAL_PLACEHOLDER_IMAGE);
});
