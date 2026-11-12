import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHotelQuery,
  buildHotelQuery,
  buildHotelHash,
  DEFAULT_HOTEL_FILTERS,
} from '../src/lib/hotelQuery.ts';

describe('hotelQuery helper', () => {
  it('parses empty or simple hash into default filters', () => {
    assert.deepEqual(parseHotelQuery(''), DEFAULT_HOTEL_FILTERS);
    assert.deepEqual(parseHotelQuery('#/hotels'), DEFAULT_HOTEL_FILTERS);
    assert.deepEqual(parseHotelQuery('#/hotels?'), DEFAULT_HOTEL_FILTERS);
  });

  it('parses full query string with special characters and values', () => {
    const hash = '#/hotels?q=Taj+Fort&city=Goa&tier=luxury&hidden=false';
    const parsed = parseHotelQuery(hash);
    assert.equal(parsed.q, 'Taj Fort');
    assert.equal(parsed.city, 'Goa');
    assert.equal(parsed.budgetTier, 'luxury');
    assert.equal(parsed.hidden, 'false');
  });

  it('handles destination and budgetTier aliases properly', () => {
    const hash = '#/hotels?destination=Jaipur&budgetTier=budget&hidden=true';
    const parsed = parseHotelQuery(hash);
    assert.equal(parsed.city, 'Jaipur');
    assert.equal(parsed.budgetTier, 'budget');
    assert.equal(parsed.hidden, 'true');
  });

  it('truncates search query q to max 60 characters on parse', () => {
    const longQ = 'A'.repeat(80);
    const hash = `#/hotels?q=${longQ}`;
    const parsed = parseHotelQuery(hash);
    assert.equal(parsed.q.length, 60);
  });

  it('buildHotelQuery drops empty and default values', () => {
    const qs = buildHotelQuery({
      q: '   ',
      city: '',
      budgetTier: 'all',
      hidden: 'all',
    });
    assert.equal(qs, '');
  });

  it('buildHotelHash encodes query parameters properly', () => {
    const hash = buildHotelHash({
      q: 'Taj & Vivanta',
      city: 'Goa',
      budgetTier: 'luxury',
      hidden: 'true',
    });
    assert.equal(hash.startsWith('#/hotels?'), true);
    assert.match(hash, /q=Taj\+%26\+Vivanta|q=Taj%20%26%20Vivanta/);
    assert.match(hash, /city=Goa/);
    assert.match(hash, /tier=luxury/);
    assert.match(hash, /hidden=true/);
  });
});

