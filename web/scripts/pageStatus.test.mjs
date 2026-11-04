import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAGE_STATUS,
  isPageAvailable,
  resolvePage,
  visibleNav,
  getAvatarInitial,
} from '../src/lib/pageStatus.ts';

test('PAGE_STATUS completeness and correctness', async (t) => {
  await t.test('every registered page has a valid status', () => {
    const validStatuses = new Set(['live', 'sample', 'internal']);
    const pages = Object.keys(PAGE_STATUS);
    assert.ok(pages.length >= 20, `Expected at least 20 pages, got ${pages.length}`);

    for (const page of pages) {
      const status = PAGE_STATUS[page];
      assert.ok(
        validStatuses.has(status),
        `Page "${page}" has invalid status "${status}"`
      );
    }
  });

  await t.test('core traveler pages are live', () => {
    const expectedLive = [
      'home',
      'explore',
      'destination',
      'search',
      'flight-detail',
      'flight-booking',
      'ai-planner',
      'my-trips',
      'journey',
      'auth',
      'profile',
      'privacy',
      'delete-account',
      'my-bookings',
      'hotels',
      'style-collection',
      'ground-transport',
    ];
    for (const page of expectedLive) {
      assert.equal(PAGE_STATUS[page], 'live', `Expected "${page}" to be live`);
    }
  });

  await t.test('sample pages are marked as sample', () => {
    const expectedSample = [
      'hotel-detail',
      'experience-detail',
      'journeys',
      'package-detail',
      'deals',
      'visa-center',
      'support',
      'booking-flow',
    ];
    for (const page of expectedSample) {
      assert.equal(PAGE_STATUS[page], 'sample', `Expected "${page}" to be sample`);
    }
  });

  await t.test('internal pages are marked as internal', () => {
    const expectedInternal = [
      'journey-control-tower',
      'supplier-intelligence',
      'finance',
      'analytics',
      'partner-dashboard',
      'corporate-dashboard',
      'command-center',
    ];
    for (const page of expectedInternal) {
      assert.equal(PAGE_STATUS[page], 'internal', `Expected "${page}" to be internal`);
    }
  });
});

test('isPageAvailable and resolvePage behaviour', async (t) => {
  await t.test('live pages are always available and resolve to themselves', () => {
    const livePages = ['home', 'explore', 'destination', 'search', 'flight-detail', 'ai-planner', 'my-trips', 'profile', 'privacy', 'delete-account'];
    for (const page of livePages) {
      assert.equal(isPageAvailable(page, false), true);
      assert.equal(isPageAvailable(page, true), true);
      assert.equal(resolvePage(page, false), page);
      assert.equal(resolvePage(page, true), page);
    }
  });

  await t.test('sample pages resolve to self when flag ON, home when flag OFF', () => {
    const samplePages = ['hotel-detail', 'experience-detail', 'deals', 'visa-center'];
    for (const page of samplePages) {
      assert.equal(isPageAvailable(page, false), false);
      assert.equal(isPageAvailable(page, true), true);
      assert.equal(resolvePage(page, false), 'home');
      assert.equal(resolvePage(page, true), page);
    }
  });

  await t.test('internal pages are never available and resolve to home regardless of flag', () => {
    const internalPages = ['finance', 'analytics', 'command-center'];
    for (const page of internalPages) {
      assert.equal(isPageAvailable(page, false), false);
      assert.equal(isPageAvailable(page, true), false);
      assert.equal(resolvePage(page, false), 'home');
      assert.equal(resolvePage(page, true), 'home');
    }
  });
});

test('visibleNav filtering', async (t) => {
  const primaryNav = [
    { label: 'Explore', page: 'explore' },
    { label: 'Journey AI', page: 'ai-planner' },
    { label: 'Flights', page: 'search', searchType: 'flights' },
    { label: 'Hotels', page: 'hotels' },
    { label: 'Experiences', page: 'search', searchType: 'experiences' },
    { label: 'Journeys', page: 'journeys' },
    { label: 'Trips', page: 'my-trips' },
    { label: 'Bookings', page: 'my-bookings' },
  ];

  await t.test('flag OFF returns [Explore, Journey AI, Flights, Hotels, Trips, Bookings]', () => {
    const visible = visibleNav(primaryNav, false);
    assert.deepEqual(
      visible.map((i) => i.label),
      ['Explore', 'Journey AI', 'Flights', 'Hotels', 'Trips', 'Bookings']
    );
  });

  await t.test('flag ON returns all primary nav items', () => {
    const visible = visibleNav(primaryNav, true);
    assert.deepEqual(
      visible.map((i) => i.label),
      ['Explore', 'Journey AI', 'Flights', 'Hotels', 'Experiences', 'Journeys', 'Trips', 'Bookings']
    );
  });
});

test('getAvatarInitial handling', async (t) => {
  await t.test('derives initial from name when provided', () => {
    assert.equal(getAvatarInitial('  arjun mehta'), 'A');
    assert.equal(getAvatarInitial('balaji'), 'B');
    assert.equal(getAvatarInitial('Zara'), 'Z');
  });

  await t.test('falls back to email when name is empty or whitespace', () => {
    assert.equal(getAvatarInitial('', 'balaji@x.com'), 'B');
    assert.equal(getAvatarInitial('   ', 'user@example.com'), 'U');
    assert.equal(getAvatarInitial(null, 'test@domain.com'), 'T');
    assert.equal(getAvatarInitial(undefined, 'alice@example.com'), 'A');
  });

  await t.test('derives initial from email when name is not passed', () => {
    assert.equal(getAvatarInitial(undefined, 'balaji@x.com'), 'B');
  });

  await t.test('returns "?" for empty or missing inputs without throwing', () => {
    assert.equal(getAvatarInitial('', ''), '?');
    assert.equal(getAvatarInitial('   ', '   '), '?');
    assert.equal(getAvatarInitial(null, null), '?');
    assert.equal(getAvatarInitial(undefined, undefined), '?');
    assert.equal(getAvatarInitial(), '?');
  });
});

