import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toBookingView,
  isUpcoming,
  matchesSearch,
  findRecentBookingForOffer,
  mapBookingStatus,
  extractLocalDatePart,
} from '../src/lib/bookingView.ts';

test('toBookingView fixture assertions and privacy protections', async (t) => {
  await t.test('Fixture 1: Full booking fixture maps stored fields accurately without inventing fields', () => {
    const raw = {
      _id: 'bk_1234567890abcdef',
      userId: 'usr_abc',
      itineraryId: 'itin_999',
      bookingReference: 'BA789X',
      orderId: 'ord_duffel_123',
      offerId: 'off_duffel_456',
      type: 'flight',
      status: 'confirmed',
      airline: 'British Airways',
      origin: 'LHR',
      destination: 'JFK',
      departureTime: '2026-11-20T10:30:00Z',
      arrivalTime: '2026-11-20T14:15:00Z',
      duration: 'PT7H45M',
      slices: [
        {
          segments: [
            {
              flight_number: 'BA177',
              origin: { name: 'Heathrow Airport', iata_code: 'LHR' },
              destination: { name: 'John F. Kennedy International Airport', iata_code: 'JFK' },
            },
          ],
        },
      ],
      passengerNames: ['Alice Smith', 'Bob Smith'],
      totalAmount: '850.50',
      currency: 'GBP',
      createdAt: '2026-11-01T15:00:00Z',
      rawOrder: { live_mode: false },
    };

    const view = toBookingView(raw);

    assert.equal(view.id, 'bk_1234567890abcdef');
    assert.equal(view.reference, 'BA789X');
    assert.equal(view.orderId, 'ord_duffel_123');
    assert.equal(view.offerId, 'off_duffel_456');
    assert.equal(view.status, 'confirmed');
    assert.equal(view.statusLabel, 'Confirmed');
    assert.equal(view.statusTone, 'success');
    assert.equal(view.route.origin, 'LHR');
    assert.equal(view.route.destination, 'JFK');
    assert.equal(view.route.originName, 'Heathrow Airport');
    assert.equal(view.route.destinationName, 'John F. Kennedy International Airport');
    assert.equal(view.departureTime, '10:30');
    assert.equal(view.arrivalTime, '14:15');
    assert.equal(view.departureDate, '20 Nov');
    assert.equal(view.carrier, 'British Airways');
    assert.deepEqual(view.flightNumbers, ['BA177']);
    assert.equal(view.duration, '7h 45m');
    assert.equal(view.durationMinutes, 465);
    assert.equal(view.totalAmount, '850.50');
    assert.equal(view.currency, 'GBP');
    assert.equal(view.formattedTotal, '£850.50');
    assert.equal(view.itineraryId, 'itin_999');
    assert.equal(view.isTest, true);
    assert.deepEqual(view.passengerNames, ['Alice Smith', 'Bob Smith']);

    // Privacy assertion: strictly NO sensitive passenger PII in view
    assert.equal(view.passengers, undefined);
    assert.equal(view.dateOfBirth, undefined);
    assert.equal(view.email, undefined);
    assert.equal(view.phoneNumber, undefined);
    assert.equal(view.passport, undefined);
  });

  await t.test('Fixture 2: Missing times fixture returns null for formatted times without throwing', () => {
    const raw = {
      _id: 'bk_missing_times',
      bookingReference: 'REF999',
      status: 'confirmed',
      airline: 'Lufthansa',
      origin: 'FRA',
      destination: 'MUC',
      departureTime: null,
      arrivalTime: null,
      totalAmount: '120.00',
      currency: 'EUR',
    };

    const view = toBookingView(raw);
    assert.equal(view.departureTime, null);
    assert.equal(view.arrivalTime, null);
    assert.equal(view.departureDate, null);
    assert.equal(view.rawDepartureTime, null);
    assert.equal(view.route.origin, 'FRA');
    assert.equal(view.route.destination, 'MUC');
  });

  await t.test('Fixture 3: Unknown status displays title-cased raw value with neutral tone', () => {
    const raw1 = {
      _id: 'bk_unknown_1',
      bookingReference: 'REF111',
      status: 'on_hold',
    };
    const view1 = toBookingView(raw1);
    assert.equal(view1.status, 'on_hold');
    assert.equal(view1.statusLabel, 'On Hold');
    assert.equal(view1.statusTone, 'neutral');

    const raw2 = {
      _id: 'bk_unknown_2',
      bookingReference: 'REF222',
      status: 'action_required',
    };
    const view2 = toBookingView(raw2);
    assert.equal(view2.statusLabel, 'Action Required');
    assert.equal(view2.statusTone, 'neutral');

    const raw3 = {
      _id: 'bk_cancelled',
      bookingReference: 'REF333',
      status: 'cancelled',
    };
    const view3 = toBookingView(raw3);
    assert.equal(view3.statusLabel, 'Cancelled');
    assert.equal(view3.statusTone, 'danger');
  });

  await t.test('Fixture 4: No passengers fixture gracefully defaults to empty array without crashing', () => {
    const raw = {
      _id: 'bk_no_passengers',
      bookingReference: 'REF000',
      status: 'confirmed',
      passengerNames: [],
      passengers: [],
    };
    const view = toBookingView(raw);
    assert.deepEqual(view.passengerNames, []);
  });
});

test('isUpcoming date boundary checks without timezone conversion', async (t) => {
  const TODAY = '2026-11-02';

  await t.test('today departure is upcoming', () => {
    assert.equal(isUpcoming('2026-11-02T08:00:00Z', TODAY), true);
    assert.equal(isUpcoming('2026-11-02T23:59:59', TODAY), true);
    assert.equal(isUpcoming('2026-11-02', TODAY), true);
  });

  await t.test('tomorrow departure is upcoming', () => {
    assert.equal(isUpcoming('2026-11-03T10:00:00Z', TODAY), true);
  });

  await t.test('yesterday departure is completed (not upcoming)', () => {
    assert.equal(isUpcoming('2026-11-01T23:00:00Z', TODAY), false);
    assert.equal(isUpcoming('2026-10-31', TODAY), false);
  });

  await t.test('month and year boundary rollovers', () => {
    // End of year rollover: 2026-12-31 vs 2027-01-01
    assert.equal(isUpcoming('2027-01-01T00:30:00', '2026-12-31'), true);
    assert.equal(isUpcoming('2026-12-31T23:30:00', '2027-01-01'), false);

    // End of month rollover: 2026-11-30 vs 2026-12-01
    assert.equal(isUpcoming('2026-12-01T06:00:00', '2026-11-30'), true);
    assert.equal(isUpcoming('2026-11-30T22:00:00', '2026-12-01'), false);
  });

  await t.test('missing or invalid departure is neither upcoming nor completed (returns false)', () => {
    assert.equal(isUpcoming(null, TODAY), false);
    assert.equal(isUpcoming(undefined, TODAY), false);
    assert.equal(isUpcoming('', TODAY), false);
    assert.equal(isUpcoming('invalid-date', TODAY), false);
  });
});

test('matchesSearch over reference, route codes, route names, and carrier', async (t) => {
  const sampleBooking = toBookingView({
    _id: 'bk_test_search',
    bookingReference: 'BA99XYZ',
    status: 'confirmed',
    airline: 'Air France',
    origin: 'CDG',
    destination: 'HND',
    slices: [
      {
        segments: [
          {
            flight_number: 'AF272',
            origin: { name: 'Charles de Gaulle Airport', iata_code: 'CDG' },
            destination: { name: 'Haneda Airport', iata_code: 'HND' },
          },
        ],
      },
    ],
  });

  await t.test('matches reference case-insensitively', () => {
    assert.equal(matchesSearch(sampleBooking, 'ba99'), true);
    assert.equal(matchesSearch(sampleBooking, 'XYZ'), true);
    assert.equal(matchesSearch(sampleBooking, 'KLM'), false);
  });

  await t.test('matches airport IATA codes', () => {
    assert.equal(matchesSearch(sampleBooking, 'cdg'), true);
    assert.equal(matchesSearch(sampleBooking, 'HND'), true);
    assert.equal(matchesSearch(sampleBooking, 'JFK'), false);
  });

  await t.test('matches airport names and carrier', () => {
    assert.equal(matchesSearch(sampleBooking, 'Gaulle'), true);
    assert.equal(matchesSearch(sampleBooking, 'Haneda'), true);
    assert.equal(matchesSearch(sampleBooking, 'Air France'), true);
    assert.equal(matchesSearch(sampleBooking, 'france'), true);
  });

  await t.test('matches flight numbers', () => {
    assert.equal(matchesSearch(sampleBooking, 'AF272'), true);
    assert.equal(matchesSearch(sampleBooking, 'af272'), true);
  });

  await t.test('empty or whitespace query matches all', () => {
    assert.equal(matchesSearch(sampleBooking, ''), true);
    assert.equal(matchesSearch(sampleBooking, '   '), true);
  });
});

test('findRecentBookingForOffer heuristic tests', async (t) => {
  const NOW = new Date('2026-11-02T19:30:00Z');

  const bExact = toBookingView({
    _id: 'bk_1',
    bookingReference: 'REF1',
    offerId: 'off_target_123',
    status: 'confirmed',
    createdAt: '2026-11-02T19:20:00Z',
  });

  const bOtherOffer = toBookingView({
    _id: 'bk_2',
    bookingReference: 'REF2',
    offerId: 'off_different_999',
    status: 'confirmed',
    createdAt: '2026-11-02T19:25:00Z',
  });

  const bFallback29Min = toBookingView({
    _id: 'bk_3',
    bookingReference: 'REF3',
    offerId: null, // No stored offerId
    origin: 'LHR',
    destination: 'JFK',
    status: 'confirmed',
    createdAt: '2026-11-02T19:01:00Z', // 29 mins before NOW
  });

  const bFallback31Min = toBookingView({
    _id: 'bk_4',
    bookingReference: 'REF4',
    offerId: null,
    origin: 'LHR',
    destination: 'JFK',
    status: 'confirmed',
    createdAt: '2026-11-02T18:59:00Z', // 31 mins before NOW
  });

  await t.test('finds exact offerId match regardless of window', () => {
    const list = [bOtherOffer, bExact];
    const match = findRecentBookingForOffer(list, 'off_target_123', NOW);
    assert.ok(match);
    assert.equal(match.id, 'bk_1');
    assert.equal(match.reference, 'REF1');
  });

  await t.test('window edge: 29 minutes is inside 30-min window and matched', () => {
    const list = [bFallback29Min];
    const match = findRecentBookingForOffer(list, 'off_target_123', NOW, 30);
    assert.ok(match);
    assert.equal(match.id, 'bk_3');
  });

  await t.test('window edge: 31 minutes is outside 30-min window and returns null', () => {
    const list = [bFallback31Min];
    const match = findRecentBookingForOffer(list, 'off_target_123', NOW, 30);
    assert.equal(match, null);
  });

  await t.test('mismatched explicit offerId is never matched by fallback', () => {
    // bOtherOffer has an explicit different offerId, so it must NOT match off_target_123
    const list = [bOtherOffer];
    const match = findRecentBookingForOffer(list, 'off_target_123', NOW, 30);
    assert.equal(match, null);
  });

  await t.test('multiple matches returns the newest booking', () => {
    const bExactOlder = toBookingView({
      _id: 'bk_older',
      bookingReference: 'REF_OLD',
      offerId: 'off_shared',
      createdAt: '2026-11-02T19:00:00Z',
    });

    const bExactNewer = toBookingView({
      _id: 'bk_newer',
      bookingReference: 'REF_NEW',
      offerId: 'off_shared',
      createdAt: '2026-11-02T19:25:00Z',
    });

    const list = [bExactOlder, bExactNewer];
    const match = findRecentBookingForOffer(list, 'off_shared', NOW);
    assert.ok(match);
    assert.equal(match.id, 'bk_newer');
    assert.equal(match.reference, 'REF_NEW');
  });
});

test('status label mapping fallbacks', () => {
  assert.deepEqual(mapBookingStatus('confirmed'), { label: 'Confirmed', tone: 'success' });
  assert.deepEqual(mapBookingStatus('CONFIRMED'), { label: 'Confirmed', tone: 'success' });
  assert.deepEqual(mapBookingStatus('cancelled'), { label: 'Cancelled', tone: 'danger' });
  assert.deepEqual(mapBookingStatus('CANCELLED'), { label: 'Cancelled', tone: 'danger' });
  assert.deepEqual(mapBookingStatus('in_review'), { label: 'In Review', tone: 'neutral' });
  assert.deepEqual(mapBookingStatus(''), { label: 'Confirmed', tone: 'success' });
  assert.deepEqual(mapBookingStatus(null), { label: 'Confirmed', tone: 'success' });
});
