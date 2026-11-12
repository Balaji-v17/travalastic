import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure VITE_API_BASE_URL is defined before module evaluation
if (!process.env.VITE_API_BASE_URL) {
  process.env.VITE_API_BASE_URL = 'http://localhost:8000';
}

import {
  normalizeName,
  isAttractionType,
  pickMatches,
  limitConcurrency,
  resolveDestinationPick,
  sessionPickCache,
  clearSessionPickCache,
  fetchStylePicks,
} from '../src/lib/stylePicks.ts';

import {
  STYLE_KEYS,
  STYLE_COLLECTIONS,
} from '../src/data/styleCollections.ts';

test('normalizeName handling', async (t) => {
  await t.test('case normalization to lowercase', () => {
    assert.equal(normalizeName('Munnar'), 'munnar');
    assert.equal(normalizeName('UDAIPUR'), 'udaipur');
  });

  await t.test('spaces trimming and collapsing', () => {
    assert.equal(normalizeName('  Havelock   Island  '), 'havelock island');
  });

  await t.test("strips punctuation including apostrophes in Cox's Bazar", () => {
    assert.equal(normalizeName("Cox's Bazar"), 'coxs bazar');
    assert.equal(normalizeName('Cox’s Bazar'), 'coxs bazar');
  });

  await t.test('strips diacritics in Zürich', () => {
    assert.equal(normalizeName('Zürich'), 'zurich');
  });

  await t.test('empty, null, or undefined strings return empty string', () => {
    assert.equal(normalizeName(''), '');
    assert.equal(normalizeName('   '), '');
    assert.equal(normalizeName(null), '');
    assert.equal(normalizeName(undefined), '');
  });
});

test('isAttractionType classification', async (t) => {
  await t.test('identifies common attraction types and categories', () => {
    assert.equal(isAttractionType('Valley'), true);
    assert.equal(isAttractionType('lake'), true);
    assert.equal(isAttractionType('Suspension Bridge'), true);
    assert.equal(isAttractionType('Waterfall'), true);
    assert.equal(isAttractionType('Ski Resort'), true);
    assert.equal(isAttractionType('Monastery'), true);
    assert.equal(isAttractionType('Monument'), true);
    assert.equal(isAttractionType('Museum'), true);
  });

  await t.test('does not classify destination, city or region as attraction', () => {
    assert.equal(isAttractionType('Destination'), false);
    assert.equal(isAttractionType('City'), false);
    assert.equal(isAttractionType('Region'), false);
    assert.equal(isAttractionType(''), false);
    assert.equal(isAttractionType(null), false);
    assert.equal(isAttractionType(undefined), false);
  });
});

test('pickMatches exact and attraction rejection rules', async (t) => {
  await t.test('exact match on name returns true', () => {
    assert.equal(pickMatches('Manali', { name: 'Manali' }), true);
    assert.equal(pickMatches('Goa', { name: 'Goa' }), true);
    assert.equal(pickMatches('Munnar', { name: '  munnar  ' }), true);
  });

  await t.test('rejects attraction records even if city matches pick', () => {
    // TouristPlace Solang Valley has city: 'Manali', type: 'Valley'
    assert.equal(
      pickMatches('Manali', { name: 'Solang Valley', city: 'Manali', type: 'Valley' }),
      false
    );
    // Pangong Tso has city: 'Leh', type: 'Lake'
    assert.equal(
      pickMatches('Leh', { name: 'Pangong Tso', city: 'Leh', type: 'Lake' }),
      false
    );
    // Laxman Jhula has city: 'Rishikesh', type: 'Suspension Bridge'
    assert.equal(
      pickMatches('Rishikesh', { name: 'Laxman Jhula', city: 'Rishikesh', type: 'Suspension Bridge' }),
      false
    );
  });

  await t.test('rejects attraction records even if name matches pick', () => {
    assert.equal(
      pickMatches('Solang Valley', { name: 'Solang Valley', type: 'Valley' }),
      false
    );
  });

  await t.test('rejects matching solely by city or destination field', () => {
    assert.equal(
      pickMatches('Munnar', { name: 'Tea Garden Resort', city: 'Munnar' }),
      false
    );
    assert.equal(
      pickMatches('Goa', { name: 'Baga Beach', destination: 'Goa' }),
      false
    );
  });

  await t.test('Goa vs Goa Gajah returns false (no substring matching)', () => {
    assert.equal(pickMatches('Goa', { name: 'Goa Gajah' }), false);
  });

  await t.test('Munnar vs Munnar Tea Museum returns false (no substring matching)', () => {
    assert.equal(pickMatches('Munnar', { name: 'Munnar Tea Museum' }), false);
  });

  await t.test('null/invalid candidate returns false', () => {
    assert.equal(pickMatches('Goa', null), false);
    assert.equal(pickMatches('', { name: 'Goa' }), false);
  });
});

test('limitConcurrency behaviour with concurrency 3', async (t) => {
  await t.test('never exceeds 3 in flight when concurrency is 3', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const tasks = Array.from({ length: 12 }, (_, i) => async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return i;
    });

    const results = await limitConcurrency(tasks, 3);
    assert.ok(maxInFlight <= 3, `Expected maxInFlight <= 3, got ${maxInFlight}`);
    assert.equal(results.length, 12);
  });

  await t.test('preserves input result order regardless of completion time', async () => {
    const tasks = [
      async () => {
        await new Promise((r) => setTimeout(r, 40));
        return 'first';
      },
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        return 'second';
      },
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        return 'third';
      },
    ];

    const results = await limitConcurrency(tasks, 3);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[0].value, 'first');
    assert.equal(results[1].status, 'fulfilled');
    assert.equal(results[1].value, 'second');
    assert.equal(results[2].status, 'fulfilled');
    assert.equal(results[2].value, 'third');
  });

  await t.test('handles a rejected task without losing the others (settle semantics)', async () => {
    const tasks = [
      async () => 'success-1',
      async () => {
        throw new Error('network-failed');
      },
      async () => 'success-2',
    ];

    const results = await limitConcurrency(tasks, 3);
    assert.equal(results.length, 3);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[0].value, 'success-1');
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[1].reason.message, 'network-failed');
    assert.equal(results[2].status, 'fulfilled');
    assert.equal(results[2].value, 'success-2');
  });
});

test('resolveDestinationPick caching and quota protection', async (t) => {
  t.beforeEach(() => {
    clearSessionPickCache();
  });

  await t.test('resolves destination pick and caches result in session memory', async () => {
    let callCount = 0;
    const mockFetch = async (url) => {
      callCount += 1;
      assert.ok(url.includes('query=Manali'));
      return [
        {
          name: 'Manali',
          photoUrl: 'https://images.pexels.com/photos/123/manali.jpg',
          photographerName: 'Photographer',
        },
      ];
    };

    const first = await resolveDestinationPick('Manali', { fetchFn: mockFetch });
    assert.ok(first);
    assert.equal(first.name, 'Manali');
    assert.equal(callCount, 1);

    // Second call for same pick (even with different casing/whitespace) must hit cache without fetching
    const second = await resolveDestinationPick('  manali  ', { fetchFn: mockFetch });
    assert.deepEqual(second, first);
    assert.equal(callCount, 1, 'Should not fetch on cache hit');
  });

  await t.test('negative caching: non-matching or empty results cache null', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount += 1;
      // Returns an attraction, which must be rejected
      return [
        {
          name: 'Solang Valley',
          type: 'Valley',
        },
      ];
    };

    const first = await resolveDestinationPick('Manali', { fetchFn: mockFetch });
    assert.equal(first, null, 'Attraction should not resolve pick');
    assert.equal(callCount, 1);

    // Second call must return cached null without calling fetch again
    const second = await resolveDestinationPick('Manali', { fetchFn: mockFetch });
    assert.equal(second, null);
    assert.equal(callCount, 1, 'Negative cache must prevent repeat queries');
  });

  await t.test('network error applies negative cache to prevent re-querying', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount += 1;
      throw new Error('500 Internal Server Error');
    };

    const first = await resolveDestinationPick('Goa', { fetchFn: mockFetch });
    assert.equal(first, null);
    assert.equal(callCount, 1);

    const second = await resolveDestinationPick('Goa', { fetchFn: mockFetch });
    assert.equal(second, null);
    assert.equal(callCount, 1, 'Failed pick must be negatively cached');
  });

  await t.test('aborted requests throw and do not cache negative results', async () => {
    const controller = new AbortController();
    controller.abort();

    const mockFetch = async (_url, options) => {
      if (options?.signal?.aborted) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }
      return [{ name: 'Goa' }];
    };

    await assert.rejects(
      async () => {
        await resolveDestinationPick('Goa', { signal: controller.signal, fetchFn: mockFetch });
      },
      { name: 'AbortError' }
    );

    // Since aborted, it should not have cached a null value
    assert.equal(sessionPickCache.has('goa'), false);
  });
});

test('STYLE_COLLECTIONS specification and constraints', async (t) => {
  await t.test('has exactly the six expected style keys', () => {
    const expectedKeys = [
      'private-escapes',
      'honeymoons',
      'wellness',
      'family',
      'adventure',
      'celebrations',
    ];
    assert.deepEqual([...STYLE_KEYS].sort(), [...expectedKeys].sort());
    assert.equal(Object.keys(STYLE_COLLECTIONS).length, 6);
  });

  await t.test('every collection has non-empty label and tagline', () => {
    for (const key of STYLE_KEYS) {
      const col = STYLE_COLLECTIONS[key];
      assert.ok(col, `Collection for ${key} should exist`);
      assert.ok(col.label && col.label.trim().length > 0, `${key} label must be non-empty`);
      assert.ok(col.tagline && col.tagline.trim().length > 0, `${key} tagline must be non-empty`);
    }
  });
});

test('fetchStylePicks web adapter', async (t) => {
  await t.test('successfully fetches picks array from API', async () => {
    const mockFetch = async (url) => {
      assert.equal(url, '/styles/honeymoons');
      return {
        key: 'honeymoons',
        picks: [
          { name: 'Munnar' },
          { name: 'Goa', imageQuery: 'North Goa Beach' },
        ],
        version: 1,
      };
    };

    const picks = await fetchStylePicks('honeymoons', { fetchFn: mockFetch });
    assert.equal(picks.length, 2);
    assert.equal(picks[0].name, 'Munnar');
    assert.equal(picks[1].name, 'Goa');
    assert.equal(picks[1].imageQuery, 'North Goa Beach');
  });

  await t.test('handles empty picks array from API', async () => {
    const mockFetch = async () => ({
      key: 'wellness',
      picks: [],
      version: 1,
    });

    const picks = await fetchStylePicks('wellness', { fetchFn: mockFetch });
    assert.deepEqual(picks, []);
  });

  await t.test('throws when API request fails', async () => {
    const mockFetch = async () => {
      throw new Error('Network error');
    };

    await assert.rejects(
      async () => {
        await fetchStylePicks('adventure', { fetchFn: mockFetch });
      },
      /Network error/
    );
  });
});

test('resolveDestinationPick with imageQuery', async (t) => {
  clearSessionPickCache();

  await t.test('uses imageQuery for API search when provided on pick item', async () => {
    let requestedUrl = '';
    const mockFetch = async (url) => {
      requestedUrl = url;
      return [
        { name: 'Calangute Beach', category: 'Beach', photoUrl: 'https://img.test/goa.jpg' },
      ];
    };

    const res = await resolveDestinationPick(
      { name: 'Goa', imageQuery: 'North Goa Beach' },
      { fetchFn: mockFetch }
    );

    assert.ok(requestedUrl.includes('North%20Goa%20Beach'));
    assert.ok(res);
    assert.equal(res.photoUrl, 'https://img.test/goa.jpg');
    // Session cache must be keyed by pick's primary name 'goa'
    assert.ok(sessionPickCache.has('goa'));
  });
});
