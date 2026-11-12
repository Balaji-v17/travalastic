import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VALID_STYLE_KEYS,
  STYLE_LABELS,
  getStyleLabel,
  isValidStyleKey,
} from '../src/lib/styleLabels.ts';

describe('styleLabels helper', () => {
  it('defines the exact six valid style collection keys', () => {
    assert.deepEqual(VALID_STYLE_KEYS, [
      'honeymoons',
      'wellness',
      'adventure',
      'family',
      'private-escapes',
      'celebrations',
    ]);
  });

  it('maps each of the six keys to its human-readable friendly label', () => {
    assert.equal(getStyleLabel('honeymoons'), 'Honeymoons');
    assert.equal(getStyleLabel('wellness'), 'Wellness');
    assert.equal(getStyleLabel('adventure'), 'Adventure');
    assert.equal(getStyleLabel('family'), 'Family');
    assert.equal(getStyleLabel('private-escapes'), 'Private escapes');
    assert.equal(getStyleLabel('celebrations'), 'Celebrations');
  });

  it('returns fallback key when key is unknown and empty string when null/undefined', () => {
    assert.equal(getStyleLabel('unknown-key'), 'unknown-key');
    assert.equal(getStyleLabel(null), '');
    assert.equal(getStyleLabel(undefined), '');
    assert.equal(getStyleLabel(''), '');
  });

  it('correctly checks valid style keys', () => {
    assert.equal(isValidStyleKey('honeymoons'), true);
    assert.equal(isValidStyleKey('wellness'), true);
    assert.equal(isValidStyleKey('adventure'), true);
    assert.equal(isValidStyleKey('family'), true);
    assert.equal(isValidStyleKey('private-escapes'), true);
    assert.equal(isValidStyleKey('celebrations'), true);

    assert.equal(isValidStyleKey('honeymoon'), false);
    assert.equal(isValidStyleKey('luxury'), false);
    assert.equal(isValidStyleKey(''), false);
    assert.equal(isValidStyleKey(null), false);
    assert.equal(isValidStyleKey(undefined), false);
  });
});

