import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diffPicks } from '../src/lib/diffPicks.ts';

describe('diffPicks helper', () => {
  it('returns hasChanges false when lists are identical', () => {
    const picks = [
      { name: 'Udaipur', imageQuery: 'Lake Pichola' },
      { name: 'Goa', imageQuery: 'South Goa' },
    ];
    const diff = diffPicks(picks, picks);
    assert.equal(diff.hasChanges, false);
    assert.equal(diff.summary, 'No changes.');
    assert.deepEqual(diff.added, []);
    assert.deepEqual(diff.removed, []);
    assert.equal(diff.reordered, false);
    assert.equal(diff.imageQueriesChanged, false);
  });

  it('detects added destinations', () => {
    const orig = [{ name: 'Udaipur', imageQuery: '' }];
    const edited = [
      { name: 'Udaipur', imageQuery: '' },
      { name: 'Jaipur', imageQuery: 'Hawa Mahal' },
    ];
    const diff = diffPicks(orig, edited);
    assert.equal(diff.hasChanges, true);
    assert.deepEqual(diff.added, ['Jaipur']);
    assert.deepEqual(diff.removed, []);
    assert.match(diff.summary, /Added: Jaipur/);
  });

  it('detects removed destinations', () => {
    const orig = [
      { name: 'Udaipur', imageQuery: '' },
      { name: 'Jaipur', imageQuery: '' },
    ];
    const edited = [{ name: 'Udaipur', imageQuery: '' }];
    const diff = diffPicks(orig, edited);
    assert.equal(diff.hasChanges, true);
    assert.deepEqual(diff.added, []);
    assert.deepEqual(diff.removed, ['Jaipur']);
    assert.match(diff.summary, /Removed: Jaipur/);
  });

  it('detects reordering of existing destinations', () => {
    const orig = [
      { name: 'A', imageQuery: '' },
      { name: 'B', imageQuery: '' },
      { name: 'C', imageQuery: '' },
    ];
    const edited = [
      { name: 'B', imageQuery: '' },
      { name: 'A', imageQuery: '' },
      { name: 'C', imageQuery: '' },
    ];
    const diff = diffPicks(orig, edited);
    assert.equal(diff.hasChanges, true);
    assert.equal(diff.reordered, true);
    assert.match(diff.summary, /Reordered/);
  });

  it('detects modified search term without destination name changes', () => {
    const orig = [{ name: 'Kabini', imageQuery: '' }];
    const edited = [{ name: 'Kabini', imageQuery: 'Kabini wildlife forest Karnataka' }];
    const diff = diffPicks(orig, edited);
    assert.equal(diff.hasChanges, true);
    assert.equal(diff.imageQueriesChanged, true);
    assert.match(diff.summary, /Photo search terms updated/);
  });

  it('caps summary length at 200 characters or less', () => {
    const orig = [];
    const edited = Array.from({ length: 12 }, (_, i) => ({
      name: `LongDestinationNameNumber${i + 1}VeryDetailedTitle`,
      imageQuery: '',
    }));
    const diff = diffPicks(orig, edited);
    assert.equal(diff.hasChanges, true);
    assert.ok(diff.summary.length <= 200, `Summary was ${diff.summary.length} characters long`);
  });
});

