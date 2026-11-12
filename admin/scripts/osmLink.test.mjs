import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getOsmLink } from '../src/lib/osmLink.ts';

describe('osmLink helper', () => {
  it('builds a valid OpenStreetMap marker link for valid numeric coordinates', () => {
    const link = getOsmLink(15.54, 73.75);
    assert.equal(link, 'https://www.openstreetmap.org/?mlat=15.54&mlon=73.75#map=16/15.54/73.75');
  });

  it('builds a valid link when string coordinates are provided', () => {
    const link = getOsmLink('28.6129', '77.2295');
    assert.equal(link, 'https://www.openstreetmap.org/?mlat=28.6129&mlon=77.2295#map=16/28.6129/77.2295');
  });

  it('rejects coordinates exceeding valid latitude range (-90 to 90)', () => {
    assert.equal(getOsmLink(95.5, 73.75), null);
    assert.equal(getOsmLink(-90.1, 73.75), null);
  });

  it('rejects coordinates exceeding valid longitude range (-180 to 180)', () => {
    assert.equal(getOsmLink(15.54, 185), null);
    assert.equal(getOsmLink(15.54, -181), null);
  });

  it('rejects Null Island (0, 0)', () => {
    assert.equal(getOsmLink(0, 0), null);
    assert.equal(getOsmLink('0', '0'), null);
  });

  it('rejects null, undefined, empty, or non-numeric inputs', () => {
    assert.equal(getOsmLink(null, 73.75), null);
    assert.equal(getOsmLink(15.54, null), null);
    assert.equal(getOsmLink(undefined, undefined), null);
    assert.equal(getOsmLink('', ''), null);
    assert.equal(getOsmLink('abc', 'def'), null);
  });
});

