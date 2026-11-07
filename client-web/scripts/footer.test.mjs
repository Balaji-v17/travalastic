import test from 'node:test';
import assert from 'node:assert/strict';

import {
  currentYear,
  filterFooterColumns,
  FOOTER_COLUMNS,
} from '../src/lib/footer.ts';

import { PAGE_STATUS } from '../src/lib/pageStatus.ts';

test('currentYear helper', async (t) => {
  await t.test('computes year correctly on Dec 31', () => {
    const dec31 = new Date(2026, 11, 31, 23, 59, 59);
    assert.equal(currentYear(dec31), 2026);
  });

  await t.test('computes year correctly on Jan 1', () => {
    const jan1 = new Date(2027, 0, 1, 0, 0, 0);
    assert.equal(currentYear(jan1), 2027);
  });

  await t.test('defaults to current calendar year when no argument is passed', () => {
    assert.equal(currentYear(), new Date().getFullYear());
  });
});

test('footer filter with flag OFF (SHOW_SAMPLE_PAGES = false)', async (t) => {
  const filtered = filterFooterColumns(FOOTER_COLUMNS, false);
  const allLinks = filtered.flatMap((col) => col.links);
  const labels = allLinks.map((l) => l.label);

  await t.test('every rendered link page is live', () => {
    assert.ok(allLinks.length > 0, 'Expected at least 1 rendered link');
    for (const link of allLinks) {
      assert.equal(
        PAGE_STATUS[link.page],
        'live',
        `Link "${link.label}" points to non-live page "${link.page}" with flag off`
      );
      assert.equal(link.status, 'live', `Link "${link.label}" must have status live`);
    }
  });

  await t.test('links include Transfers and Car rental', () => {
    assert.equal(labels.includes('Transfers'), true);
    assert.equal(labels.includes('Car rental'), true);
  });

  await t.test('no dead/unimplemented pages in footer (Prepare, Careers, Blog, etc.)', () => {
    const disallowed = [
      'About us',
      'Careers',
      'Blog',
      'Press',
      'Travel Insurance',
      'Packing lists',
      'Travel advisories',
      'Embassy info',
      'Terms',
      'Cookie settings',
      'Visa Center',
    ];
    for (const bad of disallowed) {
      assert.equal(labels.includes(bad), false, `Disallowed label "${bad}" was rendered`);
    }
  });

  await t.test('expected core live links are present', () => {
    assert.ok(labels.includes('Explore'), 'Explore should be present');
    assert.ok(labels.includes('Journey AI'), 'Journey AI should be present');
    assert.ok(labels.includes('Popular destinations'), 'Popular destinations should be present');
    assert.ok(labels.includes('Flights'), 'Flights should be present');
    assert.ok(labels.includes('Hotels'), 'Hotels should be present');
    assert.ok(labels.includes('Transfers'), 'Transfers should be present');
    assert.ok(labels.includes('Car rental'), 'Car rental should be present');
    assert.ok(labels.includes('Privacy Policy'), 'Privacy Policy should be present');
    assert.ok(labels.includes('Delete Account'), 'Delete Account should be present');
  });

  await t.test('sample links do NOT appear with flag off', () => {
    assert.equal(labels.includes('Experiences'), false);
    assert.equal(labels.includes('Help Center'), false);
  });
});

test('footer filter with flag ON (SHOW_SAMPLE_PAGES = true)', async (t) => {
  const filtered = filterFooterColumns(FOOTER_COLUMNS, true);
  const allLinks = filtered.flatMap((col) => col.links);
  const labels = allLinks.map((l) => l.label);

  await t.test('sample links appear when flag is true', () => {
    assert.ok(labels.includes('Experiences'), 'Experiences should appear with flag ON');
    assert.ok(labels.includes('Help Center'), 'Help Center should appear with flag ON');
  });

  await t.test('still excludes removed dead links (Careers, Blog, etc.)', () => {
    assert.equal(labels.includes('Careers'), false);
    assert.equal(labels.includes('Blog'), false);
    assert.equal(labels.includes('Press'), false);
    assert.equal(labels.includes('Travel Insurance'), false);
  });
});
