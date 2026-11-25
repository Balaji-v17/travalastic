import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  toJourney,
  hasRealCoverImage,
  NEUTRAL_PLACEHOLDER_IMAGE,
} from '../src/lib/journeyAdapter.ts';
import {
  shouldAttemptCoverBackfill,
  backfillMissingTripCovers,
} from '../src/lib/tripCoverBackfill.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(__dirname, '../src');
const require = createRequire(import.meta.url);

function loadTripCoverVisualComponent() {
  const filePath = path.join(WEB_SRC, 'components/trips/TripCoverVisual.tsx');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === 'react/jsx-runtime') return require('react/jsx-runtime');
    if (specifier === '../../lib/journeyAdapter') {
      return { hasRealCoverImage, NEUTRAL_PLACEHOLDER_IMAGE };
    }
    return require(specifier);
  };
  const fn = new Function('require', 'module', 'exports', transpiled.outputText);
  fn(localRequire, mod, mod.exports);
  return mod.exports.default;
}

test('TripCover lazy backfill helper skips trips with existing covers & respects concurrency <= 3', async () => {
  const attempted = new Set();
  let inFlight = 0;
  let maxInFlight = 0;
  const calledIds = [];
  const resolved = [];

  const journeys = [
    {
      id: 'already_has_cover',
      destination: 'Goa',
      coverImage: { url: 'https://images.pexels.com/photos/4428289/pexels-photo-4428289.jpeg' },
    },
    { id: 't1', destination: 'Kedarnath' },
    { id: 't2', destination: 'Kedarnath' },
    { id: 't3', destination: 'Varkala' },
    { id: 't4', destination: 'Manali' },
    { id: 'empty_dest', destination: '' },
  ];

  assert.equal(shouldAttemptCoverBackfill(journeys[0], attempted), false);
  assert.equal(shouldAttemptCoverBackfill(journeys[1], attempted), true);
  assert.equal(shouldAttemptCoverBackfill(journeys[5], attempted), false);

  await backfillMissingTripCovers({
    journeys,
    attemptedIds: attempted,
    concurrency: 3,
    fetchCover: async (id) => {
      calledIds.push(id);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight--;
      return {
        url: `https://images.pexels.com/photos/${id}.jpeg`,
        photographer: 'Test Photographer',
        sourceUrl: `https://www.pexels.com/photo/${id}/`,
        source: 'pexels',
      };
    },
    onCoverResolved: (id, cover) => resolved.push({ id, cover }),
  });

  assert.deepEqual(calledIds.sort(), ['t1', 't2', 't3', 't4']);
  assert.ok(!calledIds.includes('already_has_cover'));
  assert.ok(maxInFlight <= 3);
  assert.equal(resolved.length, 4);

  // Calling again in same session skips all already-attempted trips
  const secondCalls = [];
  await backfillMissingTripCovers({
    journeys,
    attemptedIds: attempted,
    fetchCover: async (id) => {
      secondCalls.push(id);
      return null;
    },
    onCoverResolved: () => {},
  });
  assert.deepEqual(secondCalls, []);
});

test('TripCoverVisual renders Pexels photo with attribution and renders clean no-img fallback when missing', () => {
  const TripCoverVisual = loadTripCoverVisualComponent();

  const htmlWithPhoto = renderToStaticMarkup(
    React.createElement(TripCoverVisual, {
      journey: {
        destination: 'Goa',
        coverImage: {
          url: 'https://images.pexels.com/photos/4428289/pexels-photo-4428289.jpeg',
          photographer: 'Sumit Kapai',
          photographerUrl: 'https://www.pexels.com/@sumit-kapai-2051614',
          sourceUrl: 'https://www.pexels.com/photo/4428289/',
        },
      },
    })
  );
  assert.match(htmlWithPhoto, /<img/);
  assert.match(htmlWithPhoto, /alt="Goa photo"/);
  assert.match(htmlWithPhoto, /loading="lazy"/);
  assert.match(htmlWithPhoto, /Photo: Sumit Kapai \/ Pexels/);
  assert.match(htmlWithPhoto, /href="https:\/\/www\.pexels\.com\/photo\/4428289\/"/);

  const htmlFallback = renderToStaticMarkup(
    React.createElement(TripCoverVisual, {
      journey: {
        destination: 'Xyzzyplugh',
        imageUrl: NEUTRAL_PLACEHOLDER_IMAGE,
        coverImage: null,
      },
    })
  );
  assert.doesNotMatch(htmlFallback, /<img/);
  assert.match(htmlFallback, /trip-cover-fallback/);
  assert.match(htmlFallback, /Xyzzyplugh/);
});

test('journeyAdapter maps backend coverImage and distinguishes real covers from placeholder', () => {
  const withCover = toJourney({
    _id: 'j1',
    destination: 'Varkala',
    startDate: '2027-01-10',
    endDate: '2027-01-14',
    coverImage: {
      url: 'https://images.pexels.com/photos/777/varkala.jpeg',
      photographer: 'Varkala Shots',
      sourceUrl: 'https://www.pexels.com/photo/777/',
      source: 'pexels',
    },
  });
  assert.equal(withCover.imageUrl, 'https://images.pexels.com/photos/777/varkala.jpeg');
  assert.equal(withCover.coverImage?.photographer, 'Varkala Shots');
  assert.equal(hasRealCoverImage(withCover), true);

  const withoutCover = toJourney({
    _id: 'j2',
    destination: 'NowhereCity',
    startDate: '2027-01-10',
    endDate: '2027-01-14',
  });
  assert.equal(withoutCover.imageUrl, NEUTRAL_PLACEHOLDER_IMAGE);
  assert.equal(withoutCover.coverImage, null);
  assert.equal(hasRealCoverImage(withoutCover), false);
});

