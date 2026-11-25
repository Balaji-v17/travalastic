import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_MIN_CHARS,
  shouldTriggerTypeahead,
  filterUserTrips,
  buildGlobalSearchGroups,
  isExternalOpenStreetMapResult,
  nextSearchHighlightIndex,
  isSlashShortcutTarget,
} from '../src/lib/globalSearch.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(__dirname, '../src');

test('Global search pure logic: min chars, debounce, trip auth gating, grouping & keyboard', async (t) => {
  const sampleTrips = [
    { id: 't1', title: 'Goa Beach Week', destination: 'Goa', startDate: '2026-12-10' },
    { id: 't2', title: 'Kyoto Autumn', destination: 'Kyoto', startDate: '2026-11-01' },
  ];

  const samplePlaces = [
    {
      placeId: 'p1',
      name: 'Baga Beach',
      city: 'Goa',
      state: 'Goa',
      type: 'Beach',
      source: 'tourist_places',
    },
    {
      placeId: 'p2',
      name: 'Fort Aguada',
      city: 'Goa',
      state: 'Goa',
      type: 'Fort',
      photoUrl: 'https://images.pexels.com/photos/123/aguada.jpg',
      source: 'tourist_places',
    },
  ];

  await t.test('requires at least 3 characters and uses 400ms debounce', () => {
    assert.equal(GLOBAL_SEARCH_MIN_CHARS, 3);
    assert.equal(GLOBAL_SEARCH_DEBOUNCE_MS, 400);
    assert.equal(shouldTriggerTypeahead(''), false);
    assert.equal(shouldTriggerTypeahead('go'), false);
    assert.equal(shouldTriggerTypeahead('  go  '), false);
    assert.equal(shouldTriggerTypeahead('goa'), true);
  });

  await t.test('signed-out users NEVER see My trips group', () => {
    assert.deepEqual(filterUserTrips(sampleTrips, 'goa', false), []);
    const groups = buildGlobalSearchGroups({
      query: 'goa',
      isSignedIn: false,
      trips: sampleTrips,
      places: samplePlaces,
    });
    assert.equal(groups.length, 1);
    assert.equal(groups[0].key, 'places');
    assert.equal(groups[0].label, 'Places');
  });

  await t.test('signed-in users see My trips first, then Places with city/state and real-only photos', () => {
    const groups = buildGlobalSearchGroups({
      query: 'goa',
      isSignedIn: true,
      trips: sampleTrips,
      places: samplePlaces,
    });
    assert.equal(groups.length, 2);
    assert.equal(groups[0].key, 'trips');
    assert.equal(groups[0].label, 'My trips');
    assert.equal(groups[0].items.length, 1);
    assert.equal(groups[0].items[0].id, 't1');

    assert.equal(groups[1].key, 'places');
    assert.equal(groups[1].label, 'Places');
    assert.equal(groups[1].items[0].subtitle, 'Goa, Goa · Beach');
    assert.equal(groups[1].items[0].photoUrl, undefined);
    assert.equal(
      groups[1].items[1].photoUrl,
      'https://images.pexels.com/photos/123/aguada.jpg'
    );
  });

  await t.test('isExternalOpenStreetMapResult detects overpass/nominatim fallback accurately', () => {
    assert.equal(isExternalOpenStreetMapResult(samplePlaces, false), false);
    assert.equal(
      isExternalOpenStreetMapResult([{ name: 'Foo', source: 'overpass' }], false),
      true
    );
    assert.equal(isExternalOpenStreetMapResult([], true), true);
  });

  await t.test('keyboard helpers handle ArrowDown, ArrowUp wrapping and "/" target guard', () => {
    assert.equal(nextSearchHighlightIndex(-1, 'ArrowDown', 3), 0);
    assert.equal(nextSearchHighlightIndex(2, 'ArrowDown', 3), 0);
    assert.equal(nextSearchHighlightIndex(0, 'ArrowUp', 3), 2);
    assert.equal(nextSearchHighlightIndex(0, 'ArrowDown', 0), -1);

    assert.equal(isSlashShortcutTarget({ tagName: 'INPUT' }), false);
    assert.equal(isSlashShortcutTarget({ tagName: 'TEXTAREA' }), false);
    assert.equal(isSlashShortcutTarget({ tagName: 'SELECT' }), false);
    assert.equal(isSlashShortcutTarget({ tagName: 'DIV', isContentEditable: true }), false);
    assert.equal(isSlashShortcutTarget({ tagName: 'BODY' }), true);
  });
});

test('TopNav, GlobalSearchOverlay, HomePage & ExperienceDetailPage wiring', () => {
  const topNavSrc = fs.readFileSync(
    path.join(WEB_SRC, 'components/layout/TopNav.tsx'),
    'utf8'
  );
  // Nav readability scrim, 80px scroll threshold, high-opacity white text, reduced motion
  assert.match(topNavSrc, /window\.scrollY > 80/);
  assert.match(topNavSrc, /h-\[160px\]/);
  assert.match(topNavSrc, /rgba\(0,\s*0,\s*0,\s*0\.72\)/);
  assert.match(topNavSrc, /motion-reduce:transition-none/);
  assert.doesNotMatch(topNavSrc, /text-white\/55|text-white\/60/);

  // Desktop & mobile drawer Search open GlobalSearchOverlay instead of navigate('search')
  assert.match(topNavSrc, /openGlobalSearch\(''\)/);
  assert.match(topNavSrc, /Search places &amp; trips/);
  assert.doesNotMatch(topNavSrc, /navigate\('search'\)/);

  // Sample Experiences must not call navigate('search')
  const homeSrc = fs.readFileSync(
    path.join(WEB_SRC, 'pages/traveler/HomePage.tsx'),
    'utf8'
  );
  const expSrc = fs.readFileSync(
    path.join(WEB_SRC, 'pages/traveler/ExperienceDetailPage.tsx'),
    'utf8'
  );
  assert.doesNotMatch(homeSrc, /navigate\('search'\)/);
  assert.doesNotMatch(expSrc, /navigate\('search'\)/);

  // GlobalSearchOverlay enforces fallback=0 on typeahead, fallback=1 on explicit trigger, AbortController, no trending, no logs
  const overlaySrc = fs.readFileSync(
    path.join(WEB_SRC, 'components/layout/GlobalSearchOverlay.tsx'),
    'utf8'
  );
  assert.match(overlaySrc, /AbortController/);
  assert.match(overlaySrc, /fallback=\$\{fallbackFlag\}/);
  assert.match(overlaySrc, /Search places worldwide/);
  assert.match(overlaySrc, /Results from OpenStreetMap/);
  assert.match(overlaySrc, /e\.key === 'Escape'/);
  assert.doesNotMatch(overlaySrc, /destinations\/trending/);
  assert.doesNotMatch(overlaySrc, /console\.(log|info|debug)/);
});
