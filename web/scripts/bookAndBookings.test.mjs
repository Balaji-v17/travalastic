import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRIMARY_NAV,
  BOOK_TABS,
  PAGE_ALIASES,
  PAGE_STATUS,
  normalizeBookTab,
  resolveBookAlias,
  resolvePage,
  visibleNav,
} from '../src/lib/pageStatus.ts';
import {
  resolveOpenBookTarget,
  formatHashRoute,
  parseHashRoute,
} from '../src/lib/bookRouting.ts';
import {
  IRCTC_TRAIN_SEARCH_URL,
  REDBUS_URL,
  buildRailBusUrl,
  getRailBusProviderLabel,
  getRailBusDisclosure,
} from '../src/lib/railBusLinks.ts';
import {
  HANDOFF_TTL_MS,
  rememberExternalHandoff,
  getActiveExternalHandoff,
  clearExternalHandoff,
} from '../src/lib/handoff.ts';
import { validateRecordedBookingForm } from '../src/lib/recordedBookingValidation.ts';
import { tripHasBooking, tripStatus } from '../src/lib/tripStatus.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC_DIR = path.resolve(__dirname, '../src');

function collectTsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

test('PRIMARY_NAV and Book page status aliases', async (t) => {
  await t.test('PRIMARY_NAV with flag OFF has exact 5 items [Explore, Journey AI, Book, Trips, Bookings]', () => {
    const visible = visibleNav(PRIMARY_NAV, false);
    assert.deepEqual(
      visible.map((i) => i.label),
      ['Explore', 'Journey AI', 'Book', 'Trips', 'Bookings'],
    );
    for (const item of visible) {
      assert.equal(PAGE_STATUS[item.page], 'live');
    }
  });

  await t.test('Book tab metadata has all 6 expected tabs', () => {
    assert.deepEqual(
      [...BOOK_TABS],
      ['flights', 'hotels', 'cab', 'rental', 'trains', 'buses'],
    );
  });

  await t.test('legacy booking page IDs alias to book + tab cleanly without dead-link fallback', () => {
    const expected = {
      flights: { page: 'book', tab: 'flights' },
      hotels: { page: 'book', tab: 'hotels' },
      'ground-transport': { page: 'book', tab: 'cab' },
      cab: { page: 'book', tab: 'cab' },
      'car-rental': { page: 'book', tab: 'rental' },
      trains: { page: 'book', tab: 'trains' },
      buses: { page: 'book', tab: 'buses' },
    };
    for (const [legacyPage, target] of Object.entries(expected)) {
      assert.ok(legacyPage in PAGE_ALIASES);
      assert.equal(resolvePage(legacyPage, false), 'book');
      assert.deepEqual(resolveBookAlias(legacyPage), target);
    }
    assert.deepEqual(resolveBookAlias('ground-transport', 'rental'), {
      page: 'book',
      tab: 'rental',
    });
  });
});

test('Book routing helpers & URL hash sync', async (t) => {
  await t.test('resolveOpenBookTarget normalizes valid tabs and falls back to flights', () => {
    assert.deepEqual(resolveOpenBookTarget('hotels'), { page: 'book', tab: 'hotels' });
    assert.deepEqual(resolveOpenBookTarget('rental'), { page: 'book', tab: 'rental' });
    assert.deepEqual(resolveOpenBookTarget('unknown-tab'), { page: 'book', tab: 'flights' });
    assert.equal(normalizeBookTab('trains'), 'trains');
    assert.equal(normalizeBookTab('nonsense'), 'flights');
  });

  await t.test('formatHashRoute and parseHashRoute round-trip #book/<tab> and legacy aliases', () => {
    assert.equal(formatHashRoute('book', 'hotels'), '#book/hotels');
    assert.deepEqual(parseHashRoute('#book/hotels'), { page: 'book', tab: 'hotels' });
    assert.deepEqual(parseHashRoute('#book/invalid'), { page: 'book', tab: 'flights' });
    assert.deepEqual(parseHashRoute('#hotels'), { page: 'book', tab: 'hotels' });
    assert.deepEqual(parseHashRoute('#car-rental'), { page: 'book', tab: 'rental' });
    assert.deepEqual(parseHashRoute('#my-bookings'), { page: 'my-bookings' });
  });
});

test('No live navigation call targets removed booking page IDs', () => {
  const forbiddenTargets = [
    'hotels',
    'ground-transport',
    'cab',
    'car-rental',
    'trains',
    'buses',
    'flights',
  ];
  const pattern = new RegExp(`navigate\\(['"](${forbiddenTargets.join('|')})['"]\\)`);
  const offenders = [];

  for (const file of collectTsFiles(WEB_SRC_DIR)) {
    const content = fs.readFileSync(file, 'utf8');
    if (pattern.test(content)) {
      offenders.push(path.relative(WEB_SRC_DIR, file));
    }
  }
  assert.deepEqual(offenders, [], `Found forbidden navigate() calls in: ${offenders.join(', ')}`);
});

test('Rail & bus outbound links match mobile IRCTC / RedBus builders', () => {
  assert.equal(IRCTC_TRAIN_SEARCH_URL, 'https://www.irctc.co.in/nget/train-search');
  assert.equal(REDBUS_URL, 'https://www.redbus.in/');
  assert.equal(buildRailBusUrl('train'), 'https://www.irctc.co.in/nget/train-search');
  assert.equal(buildRailBusUrl('bus'), 'https://www.redbus.in/');
  assert.equal(buildRailBusUrl('train', 'https://www.irctc.co.in/custom'), 'https://www.irctc.co.in/custom');
  assert.equal(getRailBusProviderLabel('train'), 'IRCTC');
  assert.equal(getRailBusProviderLabel('bus'), 'RedBus');

  const trainDisc = getRailBusDisclosure('train');
  const busDisc = getRailBusDisclosure('bus');
  assert.match(trainDisc.headline, /Nothing is booked here/i);
  assert.match(trainDisc.detail, /IRCTC/i);
  assert.match(busDisc.headline, /Nothing is booked here/i);
  assert.match(busDisc.detail, /RedBus/i);
});

test('External handoff sessionStorage prompt lifecycle & 30-min TTL', () => {
  const store = new Map();
  const mockStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  const t0 = 1_700_000_000_000;
  rememberExternalHandoff('hotel', 'Booking.com', t0, mockStorage);

  const active = getActiveExternalHandoff(t0 + 60_000, mockStorage);
  assert.ok(active);
  assert.equal(active.kind, 'hotel');
  assert.equal(active.providerLabel, 'Booking.com');

  const expired = getActiveExternalHandoff(t0 + HANDOFF_TTL_MS + 1, mockStorage);
  assert.equal(expired, null);

  rememberExternalHandoff('cab', 'Uber', t0, mockStorage);
  clearExternalHandoff(mockStorage);
  assert.equal(getActiveExternalHandoff(t0 + 10, mockStorage), null);
});

test('Recorded booking form validation matches backend rules', () => {
  const valid = validateRecordedBookingForm({
    kind: 'hotel',
    title: 'Grand Kyoto Ryokan',
    provider: 'Booking.com',
    startAt: '2026-12-01',
    endAt: '2026-12-05',
    amount: '450.50',
    currency: 'usd',
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.errors.amount, undefined);

  const badAmount = validateRecordedBookingForm({
    kind: 'hotel',
    title: 'Grand Kyoto Ryokan',
    provider: 'Booking.com',
    startAt: '2026-12-01',
    amount: '450.555',
    currency: 'USD',
  });
  assert.equal(badAmount.ok, false);
  assert.ok(badAmount.errors.amount);

  const badCurrency = validateRecordedBookingForm({
    kind: 'hotel',
    title: 'Grand Kyoto Ryokan',
    provider: 'Booking.com',
    startAt: '2026-12-01',
    amount: '100',
    currency: 'US',
  });
  assert.equal(badCurrency.ok, false);
  assert.ok(badCurrency.errors.currency);

  const badDates = validateRecordedBookingForm({
    kind: 'cab',
    title: 'Airport transfer',
    provider: 'Uber',
    startAt: '2026-12-05',
    endAt: '2026-12-01',
  });
  assert.equal(badDates.ok, false);
  assert.ok(badDates.errors.endAt);
});

test('tripHasBooking and tripStatus include non-cancelled recorded bookings and exclude cancelled ones', () => {
  assert.equal(
    tripHasBooking({ recordedBookings: [{ status: 'booked' }] }),
    true,
  );
  assert.equal(
    tripHasBooking({ recordedBookings: [{ status: 'cancelled' }] }),
    false,
  );
  assert.equal(
    tripHasBooking({ recordedBookingsCount: 1 }),
    true,
  );
  assert.equal(
    tripHasBooking({ recordedBookingsCount: 0 }),
    false,
  );
  assert.equal(
    tripStatus(
      {
        startDate: '2026-12-10',
        endDate: '2026-12-15',
        recordedBookingsCount: 1,
      },
      '2026-11-25',
    ),
    'upcoming',
  );
  assert.equal(
    tripStatus(
      {
        startDate: '2026-12-10',
        endDate: '2026-12-15',
        recordedBookings: [{ status: 'cancelled' }],
      },
      '2026-11-25',
    ),
    'planning',
  );
});
