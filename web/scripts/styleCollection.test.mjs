import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STYLE_KEYS,
  STYLE_COLLECTIONS,
} from '../src/data/styleCollections.ts';
import { pickMatches, normalizeName } from '../src/lib/stylePicks.ts';

test('Style collections pick resolution simulation', async (t) => {
  // Simulated search results representing backend output shape
  const mockBackendResults = {
    Munnar: [
      { name: 'Munnar Tea Museum', city: 'Idukki', type: 'Museum' },
      { name: 'Munnar', city: 'Idukki', state: 'Kerala', country: 'India', category: 'Hill Station' },
    ],
    Goa: [
      { name: 'Goa Gajah', city: 'Gianyar' },
      { name: 'Goa', city: 'Panaji', state: 'Goa', country: 'India', category: 'Beach' },
    ],
    Udaipur: [
      { name: 'City Palace', city: 'Udaipur', state: 'Rajasthan', category: 'Palace' },
      { name: 'Udaipur', state: 'Rajasthan', country: 'India', category: 'Heritage' },
    ],
    'Unknown Place': [
      { name: 'Completely Unrelated', city: 'Nowhere' },
    ],
  };

  await t.test('first matching destination result is selected and non-matches skipped', () => {
    const munnarMatches = mockBackendResults['Munnar'].filter((item) => pickMatches('Munnar', item));
    assert.equal(munnarMatches.length, 1);
    assert.equal(munnarMatches[0].name, 'Munnar');
  });

  await t.test('substring match Goa vs Goa Gajah is rejected, exact match accepted', () => {
    const goaMatches = mockBackendResults['Goa'].filter((item) => pickMatches('Goa', item));
    assert.equal(goaMatches.length, 1);
    assert.equal(goaMatches[0].name, 'Goa');
  });

  await t.test('attraction-typed record (City Palace) is rejected even when city matches, exact destination accepted', () => {
    const udaipurMatches = mockBackendResults['Udaipur'].filter((item) => pickMatches('Udaipur', item));
    assert.equal(udaipurMatches.length, 1);
    assert.equal(udaipurMatches[0].name, 'Udaipur');
  });

  await t.test('unresolved picks return empty match array and will be hidden', () => {
    const unknownMatches = mockBackendResults['Unknown Place'].filter((item) => pickMatches('Unknown Place', item));
    assert.equal(unknownMatches.length, 0);
  });
});
