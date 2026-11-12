import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeName,
  validatePicks,
  addPick,
  removePick,
  movePick,
} from '../src/lib/collectionEditor.ts';

describe('collectionEditor helper', () => {
  describe('normalizeName', () => {
    it('lowercases, trims, and collapses multiple whitespace characters', () => {
      assert.equal(normalizeName('  Udaipur  Palace '), 'udaipur palace');
      assert.equal(normalizeName('Goa\t\nBeach  '), 'goa beach');
      assert.equal(normalizeName('Jaipur'), 'jaipur');
    });

    it('returns empty string for null, undefined, or non-strings', () => {
      assert.equal(normalizeName(null), '');
      assert.equal(normalizeName(undefined), '');
      assert.equal(normalizeName(''), '');
    });
  });

  describe('validatePicks', () => {
    it('accepts an empty array of picks (empty collection is valid)', () => {
      const res = validatePicks([]);
      assert.equal(res.isValid, true);
      assert.equal(res.generalError, undefined);
      assert.deepEqual(res.fieldErrors, {});
    });

    it('accepts valid picks with names and optional imageQuery', () => {
      const picks = [
        { name: 'Udaipur', imageQuery: 'Lake Pichola Udaipur' },
        { name: 'Alleppey', imageQuery: '' },
      ];
      const res = validatePicks(picks);
      assert.equal(res.isValid, true);
      assert.deepEqual(res.fieldErrors, {});
    });

    it('rejects more than 12 picks', () => {
      const picks = Array.from({ length: 13 }, (_, i) => ({
        name: `Destination ${i + 1}`,
        imageQuery: '',
      }));
      const res = validatePicks(picks);
      assert.equal(res.isValid, false);
      assert.match(res.generalError || '', /at most 12 picks/i);
    });

    it('rejects names shorter than 2 characters or longer than 80 characters', () => {
      const resShort = validatePicks([{ name: 'A', imageQuery: '' }]);
      assert.equal(resShort.isValid, false);
      assert.match(resShort.fieldErrors[0]?.name || '', /at least 2 characters/i);

      const resLong = validatePicks([{ name: 'A'.repeat(81), imageQuery: '' }]);
      assert.equal(resLong.isValid, false);
      assert.match(resLong.fieldErrors[0]?.name || '', /cannot exceed 80 characters/i);
    });

    it('rejects HTML tags in name and imageQuery', () => {
      const res = validatePicks([
        { name: '<b>Udaipur</b>', imageQuery: 'Lake' },
        { name: 'Jaipur', imageQuery: '<script>alert(1)</script>' },
      ]);
      assert.equal(res.isValid, false);
      assert.match(res.fieldErrors[0]?.name || '', /cannot contain HTML/i);
      assert.match(res.fieldErrors[1]?.imageQuery || '', /cannot contain HTML/i);
    });

    it('rejects imageQuery longer than 100 characters', () => {
      const res = validatePicks([
        { name: 'Coorg', imageQuery: 'X'.repeat(101) },
      ]);
      assert.equal(res.isValid, false);
      assert.match(res.fieldErrors[0]?.imageQuery || '', /cannot exceed 100 characters/i);
    });

    it('detects duplicate destination names using normalized comparison', () => {
      const picks = [
        { name: 'Udaipur Palace', imageQuery: '' },
        { name: '  udaipur   palace  ', imageQuery: '' },
      ];
      const res = validatePicks(picks);
      assert.equal(res.isValid, false);
      assert.equal(res.duplicateIndices.has(0), true);
      assert.equal(res.duplicateIndices.has(1), true);
      assert.match(res.fieldErrors[0]?.name || '', /duplicate/i);
      assert.match(res.fieldErrors[1]?.name || '', /duplicate/i);
    });
  });

  describe('addPick', () => {
    it('appends pick to collection', () => {
      const initial = [{ name: 'Udaipur', imageQuery: '' }];
      const updated = addPick(initial, { name: 'Jaipur', imageQuery: 'Hawa Mahal' });
      assert.equal(updated.length, 2);
      assert.deepEqual(updated[1], { name: 'Jaipur', imageQuery: 'Hawa Mahal' });
    });

    it('does not append when already at 12 picks', () => {
      const max12 = Array.from({ length: 12 }, (_, i) => ({
        name: `Place ${i + 1}`,
        imageQuery: '',
      }));
      const attempted = addPick(max12, { name: '13th Place', imageQuery: '' });
      assert.equal(attempted.length, 12);
    });
  });

  describe('removePick', () => {
    it('removes item at given index', () => {
      const initial = [
        { name: 'A', imageQuery: '' },
        { name: 'B', imageQuery: '' },
        { name: 'C', imageQuery: '' },
      ];
      const updated = removePick(initial, 1);
      assert.equal(updated.length, 2);
      assert.equal(updated[0].name, 'A');
      assert.equal(updated[1].name, 'C');
    });

    it('leaves list unchanged on out-of-bounds index', () => {
      const initial = [{ name: 'A', imageQuery: '' }];
      assert.deepEqual(removePick(initial, -1), initial);
      assert.deepEqual(removePick(initial, 5), initial);
    });
  });

  describe('movePick', () => {
    it('moves an item up correctly', () => {
      const initial = [
        { name: 'A', imageQuery: '' },
        { name: 'B', imageQuery: '' },
        { name: 'C', imageQuery: '' },
      ];
      const moved = movePick(initial, 1, 'up');
      assert.deepEqual(moved.map((p) => p.name), ['B', 'A', 'C']);
    });

    it('moves an item down correctly', () => {
      const initial = [
        { name: 'A', imageQuery: '' },
        { name: 'B', imageQuery: '' },
        { name: 'C', imageQuery: '' },
      ];
      const moved = movePick(initial, 1, 'down');
      assert.deepEqual(moved.map((p) => p.name), ['A', 'C', 'B']);
    });

    it('leaves array unchanged when top item moves up or bottom item moves down', () => {
      const initial = [
        { name: 'A', imageQuery: '' },
        { name: 'B', imageQuery: '' },
      ];
      assert.deepEqual(movePick(initial, 0, 'up'), initial);
      assert.deepEqual(movePick(initial, 1, 'down'), initial);
    });
  });
});

