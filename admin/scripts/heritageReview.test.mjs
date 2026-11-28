import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_HERITAGE_FILTERS,
  FLAG_LABELS,
  MAX_BULK_HERITAGE_SELECTION,
  buildOsmEmbedUrl,
  canPublishPlace,
  getPlaceBlockingFlags,
  hasCuratedOverlap,
  toggleBulkSelection,
} from '../src/lib/heritageReview.ts';
import { parsePlaceQuery, buildPlaceQuery } from '../src/lib/placeQuery.ts';

describe('heritageReview helpers', () => {
  it('defaults heritage queue to pending_review and no_blocking', () => {
    assert.equal(DEFAULT_HERITAGE_FILTERS.hiddenReason, 'pending_review');
    assert.equal(DEFAULT_HERITAGE_FILTERS.flag, 'no_blocking');
    assert.equal(DEFAULT_HERITAGE_FILTERS.protectedBy, 'all');
  });

  it('identifies blocking flags and forbids publish until resolved', () => {
    const blocked = {
      state: 'Karnataka',
      reviewFlags: ['generic_name', 'no_description'],
    };
    assert.deepEqual(getPlaceBlockingFlags(blocked), ['generic_name']);
    assert.equal(canPublishPlace(blocked), false);

    const missingState = {
      state: null,
      reviewFlags: [],
    };
    assert.deepEqual(getPlaceBlockingFlags(missingState), ['state_unmapped']);
    assert.equal(canPublishPlace(missingState), false);

    const allowedWithNonBlocking = {
      state: 'Karnataka',
      reviewFlags: ['no_description', 'possible_duplicate', 'matches_curated'],
    };
    assert.deepEqual(getPlaceBlockingFlags(allowedWithNonBlocking), []);
    assert.equal(canPublishPlace(allowedWithNonBlocking), true);
    assert.equal(hasCuratedOverlap(allowedWithNonBlocking), true);
    assert.equal(FLAG_LABELS.matches_curated, 'Matches curated');
  });

  it('caps bulk selection at MAX_BULK_HERITAGE_SELECTION (50)', () => {
    let selected = [];
    for (let i = 0; i < MAX_BULK_HERITAGE_SELECTION; i += 1) {
      const next = toggleBulkSelection(selected, `id-${i}`);
      assert.equal(next.capped, false);
      selected = next.ids;
    }
    assert.equal(selected.length, 50);

    const overflow = toggleBulkSelection(selected, 'id-50');
    assert.equal(overflow.capped, true);
    assert.equal(overflow.ids.length, 50);

    const deselected = toggleBulkSelection(selected, 'id-0');
    assert.equal(deselected.capped, false);
    assert.equal(deselected.ids.length, 49);
  });

  it('builds safe OpenStreetMap embed URL only for valid non-zero coordinates', () => {
    assert.equal(buildOsmEmbedUrl(0, 0), null);
    assert.equal(buildOsmEmbedUrl(null, 76.46), null);
    assert.equal(buildOsmEmbedUrl(95, 76.46), null);

    const url = buildOsmEmbedUrl(15.335, 76.46);
    assert.ok(url);
    assert.match(url, /^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?/);
    assert.match(url, /marker=15\.335%2C76\.46/);
  });

  it('supports hiddenReason in placeQuery parse and build helpers', () => {
    const parsed = parsePlaceQuery('#/places?hidden=true&hiddenReason=pending_review');
    assert.equal(parsed.hidden, 'true');
    assert.equal(parsed.hiddenReason, 'pending_review');
    assert.equal(buildPlaceQuery(parsed), '?hidden=true&hiddenReason=pending_review');
  });

  it('PlaceFormPage shows "Not listed" placeholder and empty default for null entranceFeeINR', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/pages/PlaceFormPage.tsx'),
      'utf8'
    );
    assert.match(src, /entranceFeeINR:\s*''/);
    assert.match(src, /placeholder="Not listed"/);
    assert.doesNotMatch(src, /placeholder="0 for free"/);
  });
});
