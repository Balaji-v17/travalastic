import test from 'node:test';
import assert from 'node:assert/strict';

import {
  tripStayDates,
  validateStay,
  buildBookingUrl,
  isAffiliateUrl,
  calendarDayDifference,
  parseDateParts,
} from '../src/lib/stay.ts';

test('tripStayDates date derivation and boundary checks', async (t) => {
  await t.test('7 itinerary days -> checkIn day 1, checkOut day 7, nights 6', () => {
    // Convention: checkIn = Day 1 date, checkOut = Day 7 departure date.
    // Nights = difference in calendar days = 6 nights.
    // This accurately models checking in on arrival and checking out on departure day,
    // avoiding the earlier mobile bug where a hardcoded 4-day window (checkin + 4) was prefilled.
    const sevenDays = [
      { date: '2026-11-20' },
      { date: '2026-11-21' },
      { date: '2026-11-22' },
      { date: '2026-11-23' },
      { date: '2026-11-24' },
      { date: '2026-11-25' },
      { date: '2026-11-26' },
    ];

    const result = tripStayDates(sevenDays);
    assert.ok(result);
    assert.equal(result.checkIn, '2026-11-20');
    assert.equal(result.checkOut, '2026-11-26');
    assert.equal(result.nights, 6);
  });

  await t.test('works with string dates array directly', () => {
    const stringDays = [
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
    ];
    const result = tripStayDates(stringDays);
    assert.ok(result);
    assert.equal(result.checkIn, '2026-12-01');
    assert.equal(result.checkOut, '2026-12-05');
    assert.equal(result.nights, 4);
  });

  await t.test('month boundary rollover without timezone shift', () => {
    const days = [
      { date: '2026-11-28' },
      { date: '2026-11-29' },
      { date: '2026-11-30' },
      { date: '2026-12-01' },
      { date: '2026-12-02' },
      { date: '2026-12-03' },
      { date: '2026-12-04' },
    ];
    const result = tripStayDates(days);
    assert.ok(result);
    assert.equal(result.checkIn, '2026-11-28');
    assert.equal(result.checkOut, '2026-12-04');
    assert.equal(result.nights, 6);
  });

  await t.test('year boundary rollover without timezone shift', () => {
    const days = [
      { date: '2026-12-29' },
      { date: '2026-12-30' },
      { date: '2026-12-31' },
      { date: '2027-01-01' },
      { date: '2027-01-02' },
    ];
    const result = tripStayDates(days);
    assert.ok(result);
    assert.equal(result.checkIn, '2026-12-29');
    assert.equal(result.checkOut, '2027-01-02');
    assert.equal(result.nights, 4);
  });

  await t.test('leap day boundary rollover (2028 is a leap year)', () => {
    const days = [
      { date: '2028-02-27' },
      { date: '2028-02-28' },
      { date: '2028-02-29' },
      { date: '2028-03-01' },
    ];
    const result = tripStayDates(days);
    assert.ok(result);
    assert.equal(result.checkIn, '2028-02-27');
    assert.equal(result.checkOut, '2028-03-01');
    assert.equal(result.nights, 3);
  });

  await t.test('single day itinerary returns null (asks user for dates)', () => {
    assert.equal(tripStayDates([{ date: '2026-11-20' }]), null);
    assert.equal(tripStayDates(['2026-11-20']), null);
  });

  await t.test('empty or invalid array returns null', () => {
    assert.equal(tripStayDates([]), null);
    assert.equal(tripStayDates(null), null);
    assert.equal(tripStayDates(undefined), null);
  });

  await t.test('missing dates in days array returns null', () => {
    const daysWithMissing = [
      { date: '2026-11-20' },
      { date: '' },
      { date: '2026-11-22' },
    ];
    assert.equal(tripStayDates(daysWithMissing), null);

    const daysWithNull = [
      { date: '2026-11-20' },
      { date: null },
      { date: '2026-11-22' },
    ];
    assert.equal(tripStayDates(daysWithNull), null);
  });

  await t.test('non-monotonic dates return null', () => {
    const nonMonotonic = [
      { date: '2026-11-20' },
      { date: '2026-11-22' },
      { date: '2026-11-21' }, // backward
    ];
    assert.equal(tripStayDates(nonMonotonic), null);

    const duplicateDates = [
      { date: '2026-11-20' },
      { date: '2026-11-20' }, // same day
      { date: '2026-11-21' },
    ];
    assert.equal(tripStayDates(duplicateDates), null);
  });
});

test('validateStay input validations', async (t) => {
  const fixedToday = '2026-11-02';

  await t.test('valid stay passes', () => {
    const res = validateStay(
      {
        destination: 'Goa',
        checkIn: '2026-11-10',
        checkOut: '2026-11-16',
        guests: 2,
        rooms: 1,
      },
      fixedToday
    );
    assert.equal(res.ok, true);
    assert.equal(res.errorList.length, 0);
  });

  await t.test('empty destination is rejected', () => {
    const res = validateStay(
      {
        destination: '   ',
        checkIn: '2026-11-10',
        checkOut: '2026-11-16',
        guests: 2,
        rooms: 1,
      },
      fixedToday
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.destination);
    assert.match(res.errors.destination, /destination/i);
  });

  await t.test('past check-in date is rejected', () => {
    const res = validateStay(
      {
        destination: 'Paris',
        checkIn: '2026-11-01', // yesterday relative to 2026-11-02
        checkOut: '2026-11-06',
        guests: 2,
        rooms: 1,
      },
      fixedToday
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.checkIn);
    assert.match(res.errors.checkIn, /past/i);
  });

  await t.test('check-in today is accepted', () => {
    const res = validateStay(
      {
        destination: 'Paris',
        checkIn: '2026-11-02', // today
        checkOut: '2026-11-06',
        guests: 2,
        rooms: 1,
      },
      fixedToday
    );
    assert.equal(res.ok, true);
  });

  await t.test('check-out == check-in (0 nights) is rejected', () => {
    const res = validateStay(
      {
        destination: 'Tokyo',
        checkIn: '2026-11-10',
        checkOut: '2026-11-10',
        guests: 2,
        rooms: 1,
      },
      fixedToday
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.checkOut);
    assert.match(res.errors.checkOut, /after/i);
  });

  await t.test('check-out before check-in is rejected', () => {
    const res = validateStay(
      {
        destination: 'Tokyo',
        checkIn: '2026-11-15',
        checkOut: '2026-11-10',
        guests: 2,
        rooms: 1,
      },
      fixedToday
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.checkOut);
  });

  await t.test('stay longer than 30 nights (31 nights) is rejected', () => {
    const res = validateStay(
      {
        destination: 'Jaipur',
        checkIn: '2026-11-10',
        checkOut: '2026-12-11', // 31 nights
        guests: 2,
        rooms: 1,
      },
      fixedToday
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.nights);
    assert.match(res.errors.nights, /30 nights/i);
  });

  await t.test('exact 30 nights is accepted', () => {
    const res = validateStay(
      {
        destination: 'Jaipur',
        checkIn: '2026-11-10',
        checkOut: '2026-12-10', // exactly 30 nights
        guests: 2,
        rooms: 1,
      },
      fixedToday
    );
    assert.equal(res.ok, true);
  });

  await t.test('guests boundary: 0 is rejected, 10 is rejected, 1 and 9 pass', () => {
    const zeroGuests = validateStay(
      { destination: 'Goa', checkIn: '2026-11-10', checkOut: '2026-11-12', guests: 0, rooms: 1 },
      fixedToday
    );
    assert.equal(zeroGuests.ok, false);
    assert.ok(zeroGuests.errors.guests);

    const tenGuests = validateStay(
      { destination: 'Goa', checkIn: '2026-11-10', checkOut: '2026-11-12', guests: 10, rooms: 1 },
      fixedToday
    );
    assert.equal(tenGuests.ok, false);
    assert.ok(tenGuests.errors.guests);

    const oneGuest = validateStay(
      { destination: 'Goa', checkIn: '2026-11-10', checkOut: '2026-11-12', guests: 1, rooms: 1 },
      fixedToday
    );
    assert.equal(oneGuest.ok, true);

    const nineGuests = validateStay(
      { destination: 'Goa', checkIn: '2026-11-10', checkOut: '2026-11-12', guests: 9, rooms: 5 },
      fixedToday
    );
    assert.equal(nineGuests.ok, true);
  });

  await t.test('rooms > guests is rejected', () => {
    const res = validateStay(
      {
        destination: 'Goa',
        checkIn: '2026-11-10',
        checkOut: '2026-11-12',
        guests: 1,
        rooms: 2, // 2 rooms for 1 guest
      },
      fixedToday
    );
    assert.equal(res.ok, false);
    assert.ok(res.errors.rooms);
    assert.match(res.errors.rooms, /cannot exceed/i);
  });
});

test('buildBookingUrl query encoding and parameter sanitization', async (t) => {
  await t.test('encodes destinations with spaces, ampersands, quotes, and unicode', () => {
    const complexDest = "Cox's Bazar & Co";
    const urlStr = buildBookingUrl({
      destination: complexDest,
      checkIn: '2026-12-01',
      checkOut: '2026-12-07',
      guests: 2,
      rooms: 1,
      aid: 'travalastic_test_aid',
    });

    const parsed = new URL(urlStr);
    assert.equal(parsed.searchParams.get('ss'), "Cox's Bazar & Co");
    assert.equal(parsed.searchParams.get('checkin'), '2026-12-01');
    assert.equal(parsed.searchParams.get('checkout'), '2026-12-07');
    assert.equal(parsed.searchParams.get('group_adults'), '2');
    assert.equal(parsed.searchParams.get('no_rooms'), '1');
    assert.equal(parsed.searchParams.get('aid'), 'travalastic_test_aid');

    // Unicode test
    const unicodeUrl = buildBookingUrl({
      destination: 'Zürich',
      checkIn: '2026-12-01',
      checkOut: '2026-12-05',
    });
    const parsedUnicode = new URL(unicodeUrl);
    assert.equal(parsedUnicode.searchParams.get('ss'), 'Zürich');
  });

  await t.test('truncates overly long destination strings safely', () => {
    const veryLong = 'A'.repeat(150);
    const urlStr = buildBookingUrl({
      destination: veryLong,
      checkIn: '2026-12-01',
      checkOut: '2026-12-05',
    });
    const parsed = new URL(urlStr);
    assert.equal(parsed.searchParams.get('ss').length, 100);
  });

  await t.test('never outputs stray "undefined" or null strings', () => {
    const urlStr = buildBookingUrl({
      destination: 'Goa',
    });
    assert.equal(urlStr.includes('undefined'), false);
    assert.equal(urlStr.includes('null'), false);

    const parsed = new URL(urlStr);
    assert.equal(parsed.searchParams.get('checkin'), null);
    assert.equal(parsed.searchParams.get('checkout'), null);
    assert.equal(parsed.searchParams.get('aid'), null);
    assert.equal(parsed.searchParams.get('ss'), 'Goa');
  });

  await t.test('augments existing base URL preserving aid and host', () => {
    const serverUrl = 'https://www.booking.com/searchresults.html?aid=server_aid_123&ss=Goa&checkin=2026-11-20&checkout=2026-11-26';
    const augmented = buildBookingUrl({
      baseUrl: serverUrl,
      destination: 'Goa',
      checkIn: '2026-11-20',
      checkOut: '2026-11-26',
      guests: 3,
      rooms: 2,
    });
    const parsed = new URL(augmented);
    assert.equal(parsed.searchParams.get('aid'), 'server_aid_123');
    assert.equal(parsed.searchParams.get('ss'), 'Goa');
    assert.equal(parsed.searchParams.get('checkin'), '2026-11-20');
    assert.equal(parsed.searchParams.get('checkout'), '2026-11-26');
    assert.equal(parsed.searchParams.get('group_adults'), '3');
    assert.equal(parsed.searchParams.get('no_rooms'), '2');
  });
});

test('isAffiliateUrl detection', async (t) => {
  await t.test('detects affiliate link when aid is present and non-empty', () => {
    assert.equal(
      isAffiliateUrl('https://www.booking.com/searchresults.html?aid=travalastic_test_aid&ss=Goa'),
      true
    );
  });

  await t.test('returns false when aid is empty or absent', () => {
    assert.equal(
      isAffiliateUrl('https://www.booking.com/searchresults.html?aid=&ss=Goa'),
      false
    );
    assert.equal(
      isAffiliateUrl('https://www.booking.com/searchresults.html?ss=Goa'),
      false
    );
    assert.equal(isAffiliateUrl(''), false);
    assert.equal(isAffiliateUrl(null), false);
    assert.equal(isAffiliateUrl(undefined), false);
    assert.equal(isAffiliateUrl('invalid url'), false);
  });
});

