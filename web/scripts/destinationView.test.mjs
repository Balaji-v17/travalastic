import test from 'node:test';
import assert from 'node:assert/strict';

import {
  destinationView,
  findTripForPlace,
  buildMapsUrl,
} from '../src/lib/destinationView.ts';

const mockIds = ['tokyo', 'bali', 'paris', 'dubai', 'maldives'];

test('destinationView decisions', async (t) => {
  await t.test('place present -> live regardless of showSample flag', () => {
    const dummyPlace = { name: 'Coorg', isCurated: true };
    assert.equal(
      destinationView({
        selectedPlace: dummyPlace,
        selectedDestinationId: null,
        mockIds,
        showSample: false,
      }),
      'live'
    );
    assert.equal(
      destinationView({
        selectedPlace: dummyPlace,
        selectedDestinationId: 'tokyo',
        mockIds,
        showSample: true,
      }),
      'live'
    );
  });

  await t.test('no place + flag off + mock id -> notfound', () => {
    assert.equal(
      destinationView({
        selectedPlace: null,
        selectedDestinationId: 'tokyo',
        mockIds,
        showSample: false,
      }),
      'notfound'
    );
  });

  await t.test('no place + flag on + mock id -> sample', () => {
    assert.equal(
      destinationView({
        selectedPlace: null,
        selectedDestinationId: 'tokyo',
        mockIds,
        showSample: true,
      }),
      'sample'
    );
    assert.equal(
      destinationView({
        selectedPlace: null,
        selectedDestinationId: 'bali',
        mockIds,
        showSample: true,
      }),
      'sample'
    );
  });

  await t.test('no place + unknown id -> notfound (flag on or off)', () => {
    assert.equal(
      destinationView({
        selectedPlace: null,
        selectedDestinationId: 'unknown-place',
        mockIds,
        showSample: true,
      }),
      'notfound'
    );
    assert.equal(
      destinationView({
        selectedPlace: null,
        selectedDestinationId: 'unknown-place',
        mockIds,
        showSample: false,
      }),
      'notfound'
    );
  });

  await t.test('empty everything -> notfound', () => {
    assert.equal(
      destinationView({
        selectedPlace: null,
        selectedDestinationId: null,
        mockIds,
        showSample: false,
      }),
      'notfound'
    );
    assert.equal(
      destinationView({
        selectedPlace: null,
        selectedDestinationId: undefined,
        mockIds: [],
        showSample: false,
      }),
      'notfound'
    );
  });
});

test('findTripForPlace matching', async (t) => {
  const journeys = [
    { id: 'jrn-1', destination: 'Goa', status: 'confirmed' },
    { id: 'jrn-2', destination: 'Tokyo, Japan', status: 'confirmed' },
    { id: 'jrn-3', destination: 'New York City', status: 'confirmed' },
  ];

  await t.test('exact match returns journey', () => {
    const match = findTripForPlace(journeys, 'Goa');
    assert.ok(match);
    assert.equal(match.id, 'jrn-1');
  });

  await t.test('case, whitespace, and punctuation differences match cleanly', () => {
    assert.equal(findTripForPlace(journeys, 'goa')?.id, 'jrn-1');
    assert.equal(findTripForPlace(journeys, '  GOA   ')?.id, 'jrn-1');
    assert.equal(findTripForPlace(journeys, 'tokyo japan')?.id, 'jrn-2');
    assert.equal(findTripForPlace(journeys, 'Tokyo, Japan!')?.id, 'jrn-2');
    assert.equal(findTripForPlace(journeys, 'New  York   City')?.id, 'jrn-3');
  });

  await t.test('"Goa" must NOT match "Goa Gajah" or "Gogoa"', () => {
    assert.equal(findTripForPlace(journeys, 'Goa Gajah'), null);
    assert.equal(findTripForPlace(journeys, 'Gogoa'), null);
    assert.equal(findTripForPlace(journeys, 'South Goa'), null);

    const longerJourneys = [
      { id: 'jrn-gajah', destination: 'Goa Gajah' },
    ];
    assert.equal(findTripForPlace(longerJourneys, 'Goa'), null);
  });

  await t.test('empty names or empty journeys return null', () => {
    assert.equal(findTripForPlace(journeys, ''), null);
    assert.equal(findTripForPlace(journeys, '   '), null);
    assert.equal(findTripForPlace(journeys, null), null);
    assert.equal(findTripForPlace(journeys, undefined), null);
    assert.equal(findTripForPlace([], 'Goa'), null);
    assert.equal(findTripForPlace(null, 'Goa'), null);
    assert.equal(findTripForPlace(undefined, 'Goa'), null);
  });
});

test('buildMapsUrl deterministic generation', async (t) => {
  await t.test('coordinates containing negatives and decimals', () => {
    const url = buildMapsUrl('Sydney Opera House', -33.8568, 151.2153);
    assert.ok(url);
    assert.equal(
      url,
      'https://www.google.com/maps/search/?api=1&query=Sydney%20Opera%20House%20-33.8568%2C151.2153'
    );
  });

  await t.test('string coordinates parsed correctly', () => {
    const url = buildMapsUrl('Abbey Falls', '12.4244', '75.7182');
    assert.ok(url);
    assert.equal(
      url,
      'https://www.google.com/maps/search/?api=1&query=Abbey%20Falls%2012.4244%2C75.7182'
    );
  });

  await t.test('missing, invalid or NaN coordinates return null', () => {
    assert.equal(buildMapsUrl('Place', null, 75.7182), null);
    assert.equal(buildMapsUrl('Place', 12.4244, null), null);
    assert.equal(buildMapsUrl('Place', undefined, undefined), null);
    assert.equal(buildMapsUrl('Place', '', ''), null);
    assert.equal(buildMapsUrl('Place', 'not-a-number', 75.7182), null);
    assert.equal(buildMapsUrl('Place', 12.4244, 'invalid'), null);
  });

  await t.test('empty or missing name returns coordinates query', () => {
    const url = buildMapsUrl('', 12.4244, 75.7182);
    assert.equal(
      url,
      'https://www.google.com/maps/search/?api=1&query=12.4244%2C75.7182'
    );
  });
});

