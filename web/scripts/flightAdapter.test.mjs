import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseIsoDuration,
  formatDuration,
  formatLocalTime,
  formatDateLabel,
  layoverMinutes,
  formatMoney,
  isExpired,
  toFlightOffer,
  filterOffers,
  sortOffers,
  flightDetailView,
} from '../src/lib/flightAdapter.ts';

test('parseIsoDuration parsing and edge cases', async (t) => {
  await t.test('standard ISO duration strings', () => {
    assert.equal(parseIsoDuration('PT9H15M'), 555);
    assert.equal(parseIsoDuration('PT45M'), 45);
    assert.equal(parseIsoDuration('PT2H'), 120);
    assert.equal(parseIsoDuration('P1DT2H5M'), 1565); // 1440 + 120 + 5
    assert.equal(parseIsoDuration('P1D'), 1440);
  });

  await t.test('invalid, empty and null inputs return null', () => {
    assert.equal(parseIsoDuration(''), null);
    assert.equal(parseIsoDuration('garbage'), null);
    assert.equal(parseIsoDuration('PT'), null);
    assert.equal(parseIsoDuration(null), null);
    assert.equal(parseIsoDuration(undefined), null);
  });
});

test('formatDuration formatting', async (t) => {
  await t.test('exact test cases', () => {
    assert.equal(formatDuration(0), '0m');
    assert.equal(formatDuration(59), '59m');
    assert.equal(formatDuration(60), '1h');
    assert.equal(formatDuration(135), '2h 15m');
    assert.equal(formatDuration(1500), '25h');
  });

  await t.test('boundary and invalid cases', () => {
    assert.equal(formatDuration(null), '--');
    assert.equal(formatDuration(undefined), '--');
    assert.equal(formatDuration(-10), '--');
  });
});

test('formatLocalTime and formatDateLabel', async (t) => {
  await t.test('formatLocalTime extracts written clock digits without TZ shifting', () => {
    assert.equal(formatLocalTime('2026-11-20T14:30:00Z'), '14:30');
    assert.equal(formatLocalTime('2026-11-20T08:05:00+05:30'), '08:05');
    assert.equal(formatLocalTime('2026-11-20T23:59:00'), '23:59');
    assert.equal(formatLocalTime('invalid'), null);
    assert.equal(formatLocalTime(null), null);
  });

  await t.test('formatDateLabel formats date parts without shift', () => {
    assert.equal(formatDateLabel('2026-11-20T14:30:00Z'), '20 Nov');
    assert.equal(formatDateLabel('2026-01-05T08:00:00'), '5 Jan');
    assert.equal(formatDateLabel('invalid'), '');
    assert.equal(formatDateLabel(null), '');
  });
});

test('layoverMinutes calculations', async (t) => {
  await t.test('same airport 2 hours layover', () => {
    const arr = '2026-11-20T12:00:00';
    const dep = '2026-11-20T14:00:00';
    assert.equal(layoverMinutes(arr, dep, 'DXB', 'DXB'), 120);
  });

  await t.test('midnight rollover at same airport', () => {
    const arr = '2026-11-20T23:30:00';
    const dep = '2026-11-21T01:15:00';
    assert.equal(layoverMinutes(arr, dep, 'SIN', 'SIN'), 105);
  });

  await t.test('different airports return null', () => {
    const arr = '2026-11-20T12:00:00';
    const dep = '2026-11-20T14:00:00';
    assert.equal(layoverMinutes(arr, dep, 'LHR', 'LGW'), null);
  });

  await t.test('missing, invalid, or backwards times return null', () => {
    assert.equal(layoverMinutes(null, '2026-11-20T14:00:00'), null);
    assert.equal(layoverMinutes('2026-11-20T14:00:00', null), null);
    assert.equal(layoverMinutes('2026-11-20T16:00:00', '2026-11-20T14:00:00', 'DXB', 'DXB'), null);
  });
});

test('formatMoney formatting across currencies', async (t) => {
  await t.test('formats GBP, INR, USD correctly', () => {
    const gbp = formatMoney('123.40', 'GBP');
    assert.ok(gbp.includes('123.40') || gbp.includes('123.4'), `Expected GBP format, got ${gbp}`);

    const inr = formatMoney('1234', 'INR');
    assert.ok(inr.includes('1,234') || inr.includes('1234'), `Expected INR format, got ${inr}`);

    const usd = formatMoney('99.99', 'USD');
    assert.ok(usd.includes('99.99'), `Expected USD format, got ${usd}`);
  });
});

test('isExpired edge cases', async (t) => {
  const future = new Date('2026-11-20T12:00:00Z');
  const past = new Date('2026-11-19T12:00:00Z');
  const reference = new Date('2026-11-20T00:00:00Z');

  await t.test('returns true when expiresAt is past reference', () => {
    assert.equal(isExpired({ expiresAt: past.toISOString() }, reference), true);
  });

  await t.test('returns false when expiresAt is future of reference', () => {
    assert.equal(isExpired({ expiresAt: future.toISOString() }, reference), false);
  });

  await t.test('returns false when expiresAt is missing or null', () => {
    assert.equal(isExpired({}, reference), false);
    assert.equal(isExpired({ expiresAt: null }, reference), false);
  });
});

test('toFlightOffer normalization with 3 fixtures asserting NO invented fields', async (t) => {
  // Fixture 1: Non-stop with conditions and baggage
  const nonStopRaw = {
    id: 'off_nonstop_1',
    total_amount: '350.00',
    total_currency: 'USD',
    owner: { name: 'Delta Air Lines', iata_code: 'DL' },
    slices: [
      {
        id: 'sli_1',
        origin: { iata_code: 'JFK', name: 'John F. Kennedy Intl', city_name: 'New York' },
        destination: { iata_code: 'LAX', name: 'Los Angeles Intl', city_name: 'Los Angeles' },
        duration: 'PT5H30M',
        segments: [
          {
            id: 'seg_1',
            origin: { iata_code: 'JFK' },
            destination: { iata_code: 'LAX' },
            departing_at: '2026-12-01T08:00:00',
            arriving_at: '2026-12-01T10:30:00',
            duration: 'PT5H30M',
            marketing_carrier: { iata_code: 'DL' },
            flight_number: '101',
            passengers: [{ baggages: [{ quantity: 1, type: 'checked' }] }],
          },
        ],
      },
    ],
    conditions: {
      refund_before_departure: { allowed: true, penalty_amount: '50.00', penalty_currency: 'USD' },
      change_before_departure: { allowed: true },
    },
    expires_at: '2026-12-01T07:00:00Z',
    live_mode: false,
  };

  await t.test('Fixture 1 (non-stop) normalizes accurately', () => {
    const offer = toFlightOffer(nonStopRaw, { adults: 2 });
    assert.equal(offer.id, 'off_nonstop_1');
    assert.equal(offer.stops, 0);
    assert.equal(offer.carrier.name, 'Delta Air Lines');
    assert.equal(offer.flightNumbers[0], 'DL 101');
    assert.equal(offer.totalPrice.amount, '350.00');
    assert.equal(offer.perAdultApprox?.amount, '175.00');
    assert.equal(offer.baggage, '1 checked');
    assert.ok(offer.refundConditions?.includes('Refundable'));
    assert.equal(offer.changeConditions, 'Free changes');
    assert.equal(offer.isTest, true);
  });

  // Fixture 2: 1-stop connecting flight
  const oneStopRaw = {
    id: 'off_1stop_2',
    total_amount: '750.50',
    total_currency: 'EUR',
    owner: { name: 'Lufthansa', iata_code: 'LH' },
    slices: [
      {
        id: 'sli_2',
        duration: 'PT10H15M',
        segments: [
          {
            id: 'seg_2a',
            origin: { iata_code: 'FRA', name: 'Frankfurt Airport' },
            destination: { iata_code: 'MUC', name: 'Munich Airport' },
            departing_at: '2026-12-05T09:00:00',
            arriving_at: '2026-12-05T10:00:00',
            duration: 'PT1H',
            marketing_carrier_flight_number: 'LH 100',
          },
          {
            id: 'seg_2b',
            origin: { iata_code: 'MUC', name: 'Munich Airport' },
            destination: { iata_code: 'DEL', name: 'Indira Gandhi Intl' },
            departing_at: '2026-12-05T12:00:00',
            arriving_at: '2026-12-05T23:30:00',
            duration: 'PT8H',
            marketing_carrier_flight_number: 'LH 760',
          },
        ],
      },
    ],
  };

  await t.test('Fixture 2 (1-stop) computes layover and stops', () => {
    const offer = toFlightOffer(oneStopRaw);
    assert.equal(offer.stops, 1);
    assert.equal(offer.flightNumbers.length, 2);
    assert.deepEqual(offer.flightNumbers, ['LH 100', 'LH 760']);
    const slice = offer.slices[0];
    assert.equal(slice.segments.length, 2);

    const layover = layoverMinutes(
      slice.segments[0].arrivingAt,
      slice.segments[1].departingAt,
      slice.segments[0].destinationIata,
      slice.segments[1].originIata
    );
    assert.equal(layover, 120); // 10:00 to 12:00
  });

  // Fixture 3: Trimmed backend offer with missing baggage and conditions
  const trimmedRaw = {
    offerId: 'off_trimmed_3',
    airline: 'Air India',
    price: { amount: '12000', currency: 'INR' },
    departureTime: '2026-12-10T06:00:00',
    arrivalTime: '2026-12-10T08:15:00',
    duration: 'PT2H15M',
  };

  await t.test('Fixture 3 (trimmed) asserts NO invented fields', () => {
    const offer = toFlightOffer(trimmedRaw);
    assert.equal(offer.id, 'off_trimmed_3');
    assert.equal(offer.carrier.name, 'Air India');
    assert.equal(offer.stops, 0);
    assert.equal(offer.durationMinutes, 135);

    // CRITICAL: Must NOT invent baggage or say "Non-refundable" when conditions are absent
    assert.equal(offer.baggage, null);
    assert.equal(offer.refundConditions, null);
    assert.equal(offer.changeConditions, null);
  });
});

test('filterOffers and sortOffers', async (t) => {
  const dummyOffers = [
    {
      id: '1',
      carrier: { name: 'British Airways' },
      stops: 0,
      totalPrice: { amount: '500', currency: 'GBP' },
      departureTime: '2026-12-01T05:00:00', // Morning edge
      durationMinutes: 120,
    },
    {
      id: '2',
      carrier: { name: 'Air India' },
      stops: 1,
      totalPrice: { amount: '350', currency: 'GBP' },
      departureTime: '2026-12-01T12:00:00', // Afternoon edge
      durationMinutes: 300,
    },
    {
      id: '3',
      carrier: { name: 'Emirates' },
      stops: 2,
      totalPrice: { amount: '700', currency: 'GBP' },
      departureTime: '2026-12-01T18:00:00', // Evening edge
      durationMinutes: 450,
    },
    {
      id: '4',
      carrier: { name: 'British Airways' },
      stops: 0,
      totalPrice: { amount: '500', currency: 'GBP' },
      departureTime: '2026-12-01T21:59:00', // Evening boundary
      durationMinutes: 100,
    },
    {
      id: '5',
      carrier: { name: 'Lufthansa' },
      stops: 1,
      totalPrice: { amount: '900', currency: 'GBP' },
      departureTime: '2026-12-01T23:00:00', // Night
      durationMinutes: 200,
    },
  ];

  await t.test('stops filter', () => {
    assert.equal(filterOffers(dummyOffers, { stops: 'nonstop' }).length, 2);
    assert.equal(filterOffers(dummyOffers, { stops: '1stop' }).length, 2);
    assert.equal(filterOffers(dummyOffers, { stops: '2plus' }).length, 1);
  });

  await t.test('airline filter', () => {
    const ba = filterOffers(dummyOffers, { airlines: ['British Airways'] });
    assert.equal(ba.length, 2);
  });

  await t.test('price filter', () => {
    const filtered = filterOffers(dummyOffers, { minPrice: 400, maxPrice: 700 });
    assert.deepEqual(filtered.map((o) => o.id), ['1', '3', '4']);
  });

  await t.test('departure time bands including edges 05:00, 12:00, 18:00, 21:59', () => {
    const morning = filterOffers(dummyOffers, { timeBands: ['morning'] });
    assert.deepEqual(morning.map((o) => o.id), ['1']);

    const afternoon = filterOffers(dummyOffers, { timeBands: ['afternoon'] });
    assert.deepEqual(afternoon.map((o) => o.id), ['2']);

    const evening = filterOffers(dummyOffers, { timeBands: ['evening'] });
    assert.deepEqual(evening.map((o) => o.id), ['3', '4']);

    const night = filterOffers(dummyOffers, { timeBands: ['night'] });
    assert.deepEqual(night.map((o) => o.id), ['5']);
  });

  await t.test('stable sorting by cheapest, fastest, earliest with tie preserving', () => {
    const cheapest = sortOffers(dummyOffers, 'cheapest');
    assert.equal(cheapest[0].id, '2'); // 350
    // Offer 1 and 4 have same price 500, stable tie preserves 1 before 4
    assert.equal(cheapest[1].id, '1');
    assert.equal(cheapest[2].id, '4');

    const fastest = sortOffers(dummyOffers, 'fastest');
    assert.equal(fastest[0].id, '4'); // 100m
    assert.equal(fastest[1].id, '1'); // 120m

    const earliest = sortOffers(dummyOffers, 'earliest');
    assert.equal(earliest[0].id, '1'); // 05:00
    assert.equal(earliest[earliest.length - 1].id, '5'); // 23:00
  });
});

test('flightDetailView router decision', async (t) => {
  const dummyOffer = { id: 'real_1' };
  const mockIds = ['fl_1', 'fl_2'];

  await t.test('selectedOffer present -> live regardless of flag', () => {
    assert.equal(
      flightDetailView({
        selectedOffer: dummyOffer,
        selectedFlightId: null,
        mockIds,
        showSample: false,
      }),
      'live'
    );
    assert.equal(
      flightDetailView({
        selectedOffer: dummyOffer,
        selectedFlightId: 'fl_1',
        mockIds,
        showSample: true,
      }),
      'live'
    );
  });

  await t.test('no selectedOffer + flag on + mockId -> sample', () => {
    assert.equal(
      flightDetailView({
        selectedOffer: null,
        selectedFlightId: 'fl_1',
        mockIds,
        showSample: true,
      }),
      'sample'
    );
  });

  await t.test('no selectedOffer + flag off + mockId -> notfound', () => {
    assert.equal(
      flightDetailView({
        selectedOffer: null,
        selectedFlightId: 'fl_1',
        mockIds,
        showSample: false,
      }),
      'notfound'
    );
  });

  await t.test('no selectedOffer + unknown id -> notfound', () => {
    assert.equal(
      flightDetailView({
        selectedOffer: null,
        selectedFlightId: 'unknown',
        mockIds,
        showSample: true,
      }),
      'notfound'
    );
  });
});

