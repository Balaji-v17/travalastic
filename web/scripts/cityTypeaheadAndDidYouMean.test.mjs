import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CITY_SEARCH_DEBOUNCE_MS,
  CITY_SEARCH_MIN_CHARS,
  formatCityDisplay,
  formatCitySecondary,
  normalizeCitySearchKey,
  reduceTypeaheadKeyDown,
} from '../src/lib/citySearch.ts';
import {
  buildDidYouMeanHint,
  isDestinationInUserTrips,
} from '../src/lib/didYouMean.ts';
import { validateDna, makeDefaultDna } from '../src/lib/plannerForm.ts';
import {
  GLOBAL_SEARCH_DEBOUNCE_MS,
  GLOBAL_SEARCH_MIN_CHARS,
  buildGlobalSearchGroups,
  shouldTriggerCityTypeahead,
  shouldTriggerTypeahead,
} from '../src/lib/globalSearch.ts';

test('CityTypeahead pure keyboard logic and formatting', async (t) => {
  await t.test('uses 200ms debounce and 2 char minimum', () => {
    assert.equal(CITY_SEARCH_MIN_CHARS, 2);
    assert.equal(CITY_SEARCH_DEBOUNCE_MS, 200);
  });

  await t.test('ArrowDown/ArrowUp navigate and wrap, Enter selects active item, Enter without active passes through, Esc closes', () => {
    // Closed -> ArrowDown opens at index 0
    const open = reduceTypeaheadKeyDown({ isOpen: false, activeIndex: -1, itemCount: 3 }, 'ArrowDown');
    assert.deepEqual(open, {
      isOpen: true,
      activeIndex: 0,
      action: 'open',
      preventDefault: true,
    });

    // Wrap around ArrowDown
    const wrapDown = reduceTypeaheadKeyDown({ isOpen: true, activeIndex: 2, itemCount: 3 }, 'ArrowDown');
    assert.equal(wrapDown.activeIndex, 0);
    assert.equal(wrapDown.action, 'navigate');
    assert.equal(wrapDown.preventDefault, true);

    // Wrap around ArrowUp
    const wrapUp = reduceTypeaheadKeyDown({ isOpen: true, activeIndex: 0, itemCount: 3 }, 'ArrowUp');
    assert.equal(wrapUp.activeIndex, 2);
    assert.equal(wrapUp.action, 'navigate');

    // Enter with active selection selects and prevents form submit
    const select = reduceTypeaheadKeyDown({ isOpen: true, activeIndex: 1, itemCount: 3 }, 'Enter');
    assert.equal(select.action, 'select');
    assert.equal(select.activeIndex, 1);
    assert.equal(select.isOpen, false);
    assert.equal(select.preventDefault, true);

    // Enter with no active selection allows free typing / form submit
    const passEnter = reduceTypeaheadKeyDown({ isOpen: true, activeIndex: -1, itemCount: 3 }, 'Enter');
    assert.equal(passEnter.action, 'passthrough');
    assert.equal(passEnter.preventDefault, false);

    // Escape closes dropdown
    const esc = reduceTypeaheadKeyDown({ isOpen: true, activeIndex: 1, itemCount: 3 }, 'Escape');
    assert.equal(esc.isOpen, false);
    assert.equal(esc.activeIndex, -1);
    assert.equal(esc.action, 'close');
    assert.equal(esc.preventDefault, true);
  });

  await t.test('formats city and state/region labels', () => {
    assert.equal(
      formatCityDisplay({
        id: '1',
        name: 'Mumbai',
        admin: 'Mahārāshtra',
        country: 'India',
        iso2: 'IN',
        lat: 19.0758,
        lng: 72.8775,
        population: 24973000,
        type: 'city',
      }),
      'Mumbai, Mahārāshtra, India'
    );
    assert.equal(
      formatCityDisplay({
        id: 'region:goa::india',
        name: 'Goa',
        admin: '',
        country: 'India',
        iso2: 'IN',
        lat: 15.38,
        lng: 73.89,
        population: null,
        type: 'region',
      }),
      'Goa, India'
    );
    assert.equal(
      formatCitySecondary({
        id: 'region:goa::india',
        name: 'Goa',
        admin: '',
        country: 'India',
        iso2: 'IN',
        lat: 15.38,
        lng: 73.89,
        population: null,
        type: 'region',
      }),
      'India · State / region'
    );
  });

  await t.test('normalizes diacritics and special characters identically to backend', () => {
    assert.equal(normalizeCitySearchKey('Łódź'), 'lodz');
    assert.equal(normalizeCitySearchKey('Kraków'), 'krakow');
    assert.equal(normalizeCitySearchKey('København'), 'kobenhavn');
    assert.equal(normalizeCitySearchKey('Đà Nẵng'), 'da nang');
    assert.equal(normalizeCitySearchKey('Mahārāshtra'), 'maharashtra');
    assert.equal(normalizeCitySearchKey('Tōkyō'), 'tokyo');
    assert.equal(normalizeCitySearchKey('São Paulo'), 'sao paulo');
  });
});

test('Soft "did you mean" hint never blocks submit and respects user trip history', async (t) => {
  await t.test('builds non-blocking hint with up to 3 suggestions for unknown places like Kedarnath', () => {
    const hint = buildDidYouMeanHint({
      destination: 'Kedarnath',
      known: false,
      suggestions: [
        { id: '1', name: 'Kedar', admin: '', country: 'India', iso2: 'IN', lat: 30, lng: 79, population: 1000 },
        { id: '2', name: 'Karnal', admin: 'Haryana', country: 'India', iso2: 'IN', lat: 29, lng: 76, population: 300000 },
        { id: '3', name: 'Kota', admin: 'Rajasthan', country: 'India', iso2: 'IN', lat: 25, lng: 75, population: 1000000 },
        { id: '4', name: 'Kochi', admin: 'Kerala', country: 'India', iso2: 'IN', lat: 9, lng: 76, population: 2000000 },
      ],
    });
    assert.equal(hint.shouldShow, true);
    assert.equal(hint.blocksSubmit, false);
    assert.equal(
      hint.message,
      "We could not find 'Kedarnath' in our city list. Check the spelling, or continue if it is a small place"
    );
    assert.equal(hint.suggestions.length, 3);

    // Planner form validation still allows submitting Kedarnath freely
    const dna = makeDefaultDna(new Date(), { destination: 'Kedarnath' });
    const validation = validateDna(dna, new Date());
    assert.equal(validation.ok, true);
  });

  await t.test('treats signed-in user trip destinations (Varkala, Kedarnath, Jog Falls) as known', () => {
    const myTrips = [
      { destination: 'Varkala, Kerala' },
      { destination: 'Kedarnath' },
      { destination: 'Jog Falls' },
    ];
    assert.equal(isDestinationInUserTrips('Varkala', myTrips), true);
    assert.equal(isDestinationInUserTrips('kedarnath', myTrips), true);
    assert.equal(isDestinationInUserTrips('Jog Falls', myTrips), true);
    assert.equal(isDestinationInUserTrips('Mumbay', myTrips), false);
  });
});

test('GlobalSearchOverlay Cities group integration', () => {
  assert.equal(GLOBAL_SEARCH_MIN_CHARS, 3);
  assert.equal(GLOBAL_SEARCH_DEBOUNCE_MS, 400);
  assert.equal(shouldTriggerCityTypeahead('mu'), true);
  assert.equal(shouldTriggerTypeahead('mu'), false);

  // At 2 characters, only Cities group appears
  const twoCharGroups = buildGlobalSearchGroups({
    query: 'mu',
    isSignedIn: true,
    trips: [{ id: 't1', title: 'Mumbai Trip', destination: 'Mumbai' }],
    places: [{ placeId: 'p1', name: 'Marine Drive', city: 'Mumbai' }],
    cities: [
      { id: '1', name: 'Mumbai', admin: 'Mahārāshtra', country: 'India', iso2: 'IN', lat: 19.0758, lng: 72.8775, population: 24973000, type: 'city' },
    ],
  });
  assert.equal(twoCharGroups.length, 1);
  assert.equal(twoCharGroups[0].key, 'cities');
  assert.equal(twoCharGroups[0].label, 'Cities');
  assert.equal(twoCharGroups[0].items[0].name, 'Mumbai');
  assert.equal(twoCharGroups[0].items[0].subtitle, 'Mahārāshtra, India');

  // At 3+ characters, My trips -> Cities -> Places all appear
  const threeCharGroups = buildGlobalSearchGroups({
    query: 'mum',
    isSignedIn: true,
    trips: [{ id: 't1', title: 'Mumbai Trip', destination: 'Mumbai' }],
    places: [{ placeId: 'p1', name: 'Marine Drive', city: 'Mumbai' }],
    cities: [
      { id: '1', name: 'Mumbai', admin: 'Mahārāshtra', country: 'India', iso2: 'IN', lat: 19.0758, lng: 72.8775, population: 24973000, type: 'city' },
    ],
  });
  assert.deepEqual(threeCharGroups.map((g) => g.key), ['trips', 'cities', 'places']);
});

