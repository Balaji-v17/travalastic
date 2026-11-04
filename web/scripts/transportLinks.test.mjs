import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildUberUrl,
  validateRental,
  buildRentalUrl,
  extractActivityCoordinates,
  activityHasCoordinates,
  isAffiliateUrl,
} from '../src/lib/transportLinks.ts';

test('buildUberUrl universal link construction', async (t) => {
  await t.test('defaults to pickup=my_location when pickup is omitted or null', () => {
    const urlStr = buildUberUrl({});
    const url = new URL(urlStr);
    assert.equal(url.origin, 'https://m.uber.com');
    assert.equal(url.pathname, '/ul/');
    assert.equal(url.searchParams.get('action'), 'setPickup');
    assert.equal(url.searchParams.get('pickup'), 'my_location');
    assert.equal(url.searchParams.has('dropoff[latitude]'), false);
    assert.equal(url.searchParams.has('client_id'), false);
  });

  await t.test('handles valid dropoff with negative & decimal coordinates', () => {
    const urlStr = buildUberUrl({
      dropoff: {
        latitude: -33.8688,
        longitude: 151.2093,
        nickname: 'Sydney Opera House',
      },
    });
    const url = new URL(urlStr);
    assert.equal(url.searchParams.get('action'), 'setPickup');
    assert.equal(url.searchParams.get('pickup'), 'my_location');
    assert.equal(url.searchParams.get('dropoff[latitude]'), '-33.8688');
    assert.equal(url.searchParams.get('dropoff[longitude]'), '151.2093');
    assert.equal(url.searchParams.get('dropoff[nickname]'), 'Sydney Opera House');
  });

  await t.test('truncates nickname to 100 characters and encodes special characters safely', () => {
    const longName = 'A'.repeat(150);
    const urlStr = buildUberUrl({
      dropoff: {
        latitude: 48.8584,
        longitude: 2.2945,
        nickname: `${longName} & Café / Paris #1`,
      },
    });
    const url = new URL(urlStr);
    const nick = url.searchParams.get('dropoff[nickname]');
    assert.ok(nick);
    assert.equal(nick.length, 100);
    assert.equal(nick, 'A'.repeat(100));
  });

  await t.test('latitude out of range (> 90 or < -90) or NaN omits dropoff params', () => {
    const outOfRangeUrl = buildUberUrl({
      dropoff: {
        latitude: 91,
        longitude: 10,
        nickname: 'North of North Pole',
      },
    });
    const outUrl = new URL(outOfRangeUrl);
    assert.equal(outUrl.searchParams.has('dropoff[latitude]'), false);

    const nanUrl = buildUberUrl({
      dropoff: {
        latitude: NaN,
        longitude: 10,
        nickname: 'Invalid',
      },
    });
    const nUrl = new URL(nanUrl);
    assert.equal(nUrl.searchParams.has('dropoff[latitude]'), false);
  });

  await t.test('explicit valid pickup replaces my_location', () => {
    const urlStr = buildUberUrl({
      pickup: {
        latitude: 37.7749,
        longitude: -122.4194,
        nickname: 'San Francisco Downtown',
      },
      dropoff: {
        latitude: 37.6213,
        longitude: -122.379,
        nickname: 'SFO Airport',
      },
    });
    const url = new URL(urlStr);
    assert.equal(url.searchParams.has('pickup'), false); // 'my_location' not used
    assert.equal(url.searchParams.get('pickup[latitude]'), '37.7749');
    assert.equal(url.searchParams.get('pickup[longitude]'), '-122.4194');
    assert.equal(url.searchParams.get('pickup[nickname]'), 'San Francisco Downtown');
    assert.equal(url.searchParams.get('dropoff[latitude]'), '37.6213');
  });

  await t.test('client_id is added when provided and non-empty', () => {
    const urlWithClient = buildUberUrl({
      clientId: 'my-uber-client-123',
    });
    const parsed = new URL(urlWithClient);
    assert.equal(parsed.searchParams.get('client_id'), 'my-uber-client-123');

    const urlEmptyClient = buildUberUrl({
      clientId: '   ',
    });
    const parsedEmpty = new URL(urlEmptyClient);
    assert.equal(parsedEmpty.searchParams.has('client_id'), false);
  });

  await t.test('never contains "undefined" or "null" in the serialized URL string', () => {
    const urlStr = buildUberUrl({
      pickup: null,
      dropoff: {
        latitude: null,
        longitude: undefined,
        nickname: null,
      },
      clientId: undefined,
    });
    assert.equal(urlStr.includes('undefined'), false);
    assert.equal(urlStr.includes('null'), false);
  });
});

test('validateRental inputs and boundary conditions', async (t) => {
  const fixedNow = new Date('2026-11-10T12:00:00Z');

  await t.test('valid rental returns valid: true with no errors', () => {
    const res = validateRental(
      {
        location: 'Paris Charles de Gaulle',
        pickupAt: '2026-11-12',
        dropoffAt: '2026-11-19',
        driverAge: 30,
      },
      fixedNow
    );
    assert.equal(res.valid, true);
    assert.equal(res.errorList.length, 0);
  });

  await t.test('location boundaries: required, min 2 chars, max 80 chars', () => {
    const missing = validateRental({ location: '', pickupAt: '2026-11-12', dropoffAt: '2026-11-15' }, fixedNow);
    assert.equal(missing.valid, false);
    assert.equal(missing.errors.location, 'Pickup location is required.');

    const tooShort = validateRental({ location: 'A', pickupAt: '2026-11-12', dropoffAt: '2026-11-15' }, fixedNow);
    assert.equal(tooShort.valid, false);
    assert.equal(tooShort.errors.location, 'Pickup location must be at least 2 characters.');

    const tooLong = validateRental({ location: 'Z'.repeat(81), pickupAt: '2026-11-12', dropoffAt: '2026-11-15' }, fixedNow);
    assert.equal(tooLong.valid, false);
    assert.equal(tooLong.errors.location, 'Pickup location cannot exceed 80 characters.');

    const valid80 = validateRental({ location: 'Z'.repeat(80), pickupAt: '2026-11-12', dropoffAt: '2026-11-15' }, fixedNow);
    assert.equal(valid80.errors.location, undefined);
  });

  await t.test('past pickup date is rejected', () => {
    const past = validateRental({ location: 'Rome', pickupAt: '2026-11-09', dropoffAt: '2026-11-15' }, fixedNow);
    assert.equal(past.valid, false);
    assert.equal(past.errors.pickupAt, 'Pickup date cannot be in the past.');
  });

  await t.test('drop-off date must be after pickup date', () => {
    const sameDay = validateRental({ location: 'Rome', pickupAt: '2026-11-12', dropoffAt: '2026-11-12' }, fixedNow);
    assert.equal(sameDay.valid, false);
    assert.equal(sameDay.errors.dropoffAt, 'Drop-off date must be after pickup date.');

    const earlierDay = validateRental({ location: 'Rome', pickupAt: '2026-11-15', dropoffAt: '2026-11-12' }, fixedNow);
    assert.equal(earlierDay.valid, false);
    assert.equal(earlierDay.errors.dropoffAt, 'Drop-off date must be after pickup date.');
  });

  await t.test('rental duration max 30 days: 30 days passes, 31 days fails', () => {
    // 2026-11-12 to 2026-12-12 is exactly 30 days
    const thirtyDays = validateRental({ location: 'Rome', pickupAt: '2026-11-12', dropoffAt: '2026-12-12' }, fixedNow);
    assert.equal(thirtyDays.valid, true);

    // 2026-11-12 to 2026-12-13 is 31 days
    const thirtyOneDays = validateRental({ location: 'Rome', pickupAt: '2026-11-12', dropoffAt: '2026-12-13' }, fixedNow);
    assert.equal(thirtyOneDays.valid, false);
    assert.equal(thirtyOneDays.errors.dropoffAt, 'Rental duration cannot exceed 30 days.');
  });

  await t.test('driver age boundaries: optional, min 21, max 75', () => {
    const emptyAge = validateRental({ location: 'Rome', pickupAt: '2026-11-12', dropoffAt: '2026-11-15', driverAge: '' }, fixedNow);
    assert.equal(emptyAge.valid, true);

    const nullAge = validateRental({ location: 'Rome', pickupAt: '2026-11-12', dropoffAt: '2026-11-15', driverAge: null }, fixedNow);
    assert.equal(nullAge.valid, true);

    const age20 = validateRental({ location: 'Rome', pickupAt: '2026-11-12', dropoffAt: '2026-11-15', driverAge: 20 }, fixedNow);
    assert.equal(age20.valid, false);
    assert.equal(age20.errors.driverAge, 'Driver age must be between 21 and 75.');

    const age21 = validateRental({ location: 'Rome', pickupAt: '2026-11-12', dropoffAt: '2026-11-15', driverAge: 21 }, fixedNow);
    assert.equal(age21.valid, true);

    const age75 = validateRental({ location: 'Rome', pickupAt: '2026-11-12', dropoffAt: '2026-11-15', driverAge: 75 }, fixedNow);
    assert.equal(age75.valid, true);

    const age76 = validateRental({ location: 'Rome', pickupAt: '2026-11-12', dropoffAt: '2026-11-15', driverAge: 76 }, fixedNow);
    assert.equal(age76.valid, false);
    assert.equal(age76.errors.driverAge, 'Driver age must be between 21 and 75.');
  });
});

test('buildRentalUrl fallback generation', async (t) => {
  await t.test('constructs search URL with location and optional dates', () => {
    const urlStr = buildRentalUrl({
      location: 'Milan Malpensa',
      pickupDate: '2026-11-20',
      dropoffDate: '2026-11-25',
      affiliateId: '12345',
    });
    const url = new URL(urlStr);
    assert.equal(url.origin, 'https://www.rentalcars.com');
    assert.equal(url.pathname, '/search-results');
    assert.equal(url.searchParams.get('locationName'), 'Milan Malpensa');
    assert.equal(url.searchParams.get('dropLocationName'), 'Milan Malpensa');
    assert.equal(url.searchParams.get('pickupDate'), '2026-11-20');
    assert.equal(url.searchParams.get('dropoffDate'), '2026-11-25');
    assert.equal(url.searchParams.get('aid'), '12345');
    assert.equal(url.searchParams.get('affiliateCode'), '12345');
  });
});

test('activity coordinates extraction and Null Island handling', async (t) => {
  await t.test('extracts from location: { lat, lon, placeName }', () => {
    const coords = extractActivityCoordinates({
      title: 'Uluwatu Temple',
      location: { lat: -8.8291, lon: 115.0849, placeName: 'Pecatu, Bali' },
    });
    assert.ok(coords);
    assert.equal(coords.latitude, -8.8291);
    assert.equal(coords.longitude, 115.0849);
    assert.equal(coords.name, 'Uluwatu Temple');
    assert.equal(activityHasCoordinates({ location: { lat: -8.8291, lon: 115.0849 } }), true);
  });

  await t.test('extracts string numbers safely', () => {
    const coords = extractActivityCoordinates({
      title: 'Tokyo Skytree',
      latitude: '35.7100',
      longitude: '139.8107',
    });
    assert.ok(coords);
    assert.equal(coords.latitude, 35.71);
    assert.equal(coords.longitude, 139.8107);
  });

  await t.test('(0, 0) Null Island is treated as valid coordinate', () => {
    const coords = extractActivityCoordinates({
      title: 'Null Island Station',
      location: { lat: 0, lon: 0 },
    });
    assert.ok(coords);
    assert.equal(coords.latitude, 0);
    assert.equal(coords.longitude, 0);
    assert.equal(activityHasCoordinates({ location: { lat: 0, lon: 0 } }), true);
  });

  await t.test('missing, null, or out of range coordinates return null', () => {
    assert.equal(extractActivityCoordinates(null), null);
    assert.equal(extractActivityCoordinates({}), null);
    assert.equal(extractActivityCoordinates({ location: null }), null);
    assert.equal(extractActivityCoordinates({ location: { lat: null, lon: 10 } }), null);
    assert.equal(extractActivityCoordinates({ location: { lat: 100, lon: 10 } }), null);
    assert.equal(extractActivityCoordinates({ location: { lat: 10, lon: 200 } }), null);
    assert.equal(activityHasCoordinates({ location: null }), false);
  });
});

test('isAffiliateUrl detection', async (t) => {
  await t.test('detects aid or affiliateCode query parameters', () => {
    assert.equal(isAffiliateUrl('https://www.rentalcars.com/search-results?aid=123'), true);
    assert.equal(isAffiliateUrl('https://www.rentalcars.com/search-results?affiliateCode=xyz'), true);
    assert.equal(isAffiliateUrl('https://www.rentalcars.com/search-results?locationName=Rome'), false);
    assert.equal(isAffiliateUrl(null), false);
    assert.equal(isAffiliateUrl(''), false);
    assert.equal(isAffiliateUrl('not-a-valid-url'), false);
  });
});

