import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePlaceQuery,
  buildPlaceQuery,
  buildPlaceHash,
  DEFAULT_PLACE_FILTERS,
} from '../src/lib/placeQuery.ts';

describe('placeQuery helper', () => {
  it('parses empty or simple hash into default filters', () => {
    assert.deepEqual(parsePlaceQuery(''), DEFAULT_PLACE_FILTERS);
    assert.deepEqual(parsePlaceQuery('#/places'), DEFAULT_PLACE_FILTERS);
    assert.deepEqual(parsePlaceQuery('#/places?'), DEFAULT_PLACE_FILTERS);
  });

  it('parses full query string with special characters and values', () => {
    const hash = '#/places?q=Baga+Beach&city=North+Goa&state=Goa&type=Beach&hidden=false';
    const parsed = parsePlaceQuery(hash);
    assert.equal(parsed.q, 'Baga Beach');
    assert.equal(parsed.city, 'North Goa');
    assert.equal(parsed.state, 'Goa');
    assert.equal(parsed.type, 'Beach');
    assert.equal(parsed.hidden, 'false');
  });

  it('truncates search query q to max 60 characters on parse', () => {
    const longQ = 'A'.repeat(80);
    const hash = `#/places?q=${longQ}`;
    const parsed = parsePlaceQuery(hash);
    assert.equal(parsed.q.length, 60);
  });

  it('buildPlaceQuery drops empty and default values', () => {
    const qs = buildPlaceQuery({
      q: '   ',
      city: '',
      hidden: 'all',
    });
    assert.equal(qs, '');
  });

  it('buildPlaceHash encodes query parameters properly', () => {
    const hash = buildPlaceHash({
      q: 'Fort Aguada & Lighthouse',
      city: 'Goa',
      hidden: 'true',
    });
    assert.equal(hash.startsWith('#/places?'), true);
    assert.match(hash, /q=Fort\+Aguada\+%26\+Lighthouse|q=Fort%20Aguada%20%26%20Lighthouse/);
    assert.match(hash, /city=Goa/);
    assert.match(hash, /hidden=true/);
  });
});

