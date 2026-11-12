import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diffPlace } from '../src/lib/diffPlace.ts';

describe('diffPlace helper', () => {
  const originalPlace = {
    _id: '6abb3f711d4fb0f0d98a0ae6',
    name: 'Calangute Beach',
    city: 'Goa',
    state: 'Goa',
    type: 'Beach',
    zone: 'Western',
    significance: 'Historic tourist hotspot',
    bestTimeToVisit: 'Winter',
    latitude: 15.54,
    longitude: 73.75,
    googleRating: 4.5,
    entranceFeeINR: 0,
    timeNeededHours: 2.5,
  };

  const matchingFormValues = {
    name: 'Calangute Beach',
    city: 'Goa',
    state: 'Goa',
    type: 'Beach',
    zone: 'Western',
    significance: 'Historic tourist hotspot',
    bestTimeToVisit: 'Winter',
    latitude: '15.54',
    longitude: '73.75',
    googleRating: '4.5',
    entranceFeeINR: '0',
    timeNeededHours: '2.5',
  };

  it('returns empty object {} when no fields have changed', () => {
    const diff = diffPlace(originalPlace, matchingFormValues);
    assert.deepEqual(diff, {});
  });

  it('detects a single text field modification', () => {
    const diff = diffPlace(originalPlace, {
      ...matchingFormValues,
      significance: 'Newly renovated coastal beach and promenade',
    });
    assert.deepEqual(diff, {
      significance: 'Newly renovated coastal beach and promenade',
    });
  });

  it('sends null when clearing an optional string or numeric field', () => {
    const diff = diffPlace(originalPlace, {
      ...matchingFormValues,
      zone: '', // cleared
      timeNeededHours: '', // cleared
    });
    assert.deepEqual(diff, {
      zone: null,
      timeNeededHours: null,
    });
  });

  it('always pairs latitude and longitude when ONLY latitude changed', () => {
    const diff = diffPlace(originalPlace, {
      ...matchingFormValues,
      latitude: '15.56', // changed
      // longitude left as 73.75
    });
    assert.deepEqual(diff, {
      latitude: 15.56,
      longitude: 73.75,
    });
  });

  it('always pairs latitude and longitude when ONLY longitude changed', () => {
    const diff = diffPlace(originalPlace, {
      ...matchingFormValues,
      longitude: '73.78', // changed
      // latitude left as 15.54
    });
    assert.deepEqual(diff, {
      latitude: 15.54,
      longitude: 73.78,
    });
  });

  it('returns full payload in create mode (original is null)', () => {
    const newValues = {
      name: 'Aguada Fort',
      city: 'Goa',
      state: 'Goa',
      type: 'Fort',
      latitude: '15.49',
      longitude: '73.77',
      zone: 'Western',
      entranceFeeINR: '50',
    };
    const diff = diffPlace(null, newValues);
    assert.equal(diff.name, 'Aguada Fort');
    assert.equal(diff.city, 'Goa');
    assert.equal(diff.latitude, 15.49);
    assert.equal(diff.longitude, 73.77);
    assert.equal(diff.entranceFeeINR, 50);
  });
});

