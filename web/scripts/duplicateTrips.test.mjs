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
  datesOverlap,
  groupDuplicateTrips,
  pickMostCompleteTripId,
  validateGroupKeepSelection,
  getDeletionConfirmationRequirements,
  canConfirmPermanentDelete,
  deleteTripsSequentially,
  readDuplicateNoticeDismissed,
  writeDuplicateNoticeDismissed,
  getTripSummaryMetrics,
} from '../src/lib/duplicateTrips.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC = path.resolve(__dirname, '../src');
const require = createRequire(import.meta.url);

function loadTsxComponent(relPath, mocks = {}) {
  const filePath = path.join(WEB_SRC, relPath);
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
    if (specifier === 'react') return React;
    if (mocks[specifier]) return mocks[specifier];
    return require(specifier);
  };
  const fn = new Function('require', 'module', 'exports', transpiled.outputText);
  fn(localRequire, mod, mod.exports);
  return mod.exports.default;
}

function makeJourney(overrides = {}) {
  return {
    id: overrides.id || 'trip_1',
    travelerId: 'u_1',
    destination: 'Goa',
    destinationId: 'goa',
    title: 'Goa Trip',
    status: 'planning',
    startDate: '2026-12-01',
    endDate: '2026-12-04',
    travelers: 1,
    bookings: [],
    totalSpend: 0,
    currency: 'INR',
    imageUrl: '',
    itinerary: [],
    notifications: [],
    disruptions: [],
    editCount: 0,
    flightBookingsCount: 0,
    recordedBookingsCount: 0,
    ...overrides,
  };
}

test('groupDuplicateTrips separates exact duplicates from overlapping-date similar trips without Date parsing', () => {
  const src = fs.readFileSync(path.join(WEB_SRC, 'lib/duplicateTrips.ts'), 'utf8');
  assert.equal(/\bnew Date\s*\(/.test(src), false, 'duplicateTrips.ts must never call new Date(...)');

  const journeys = [
    makeJourney({ id: 'v1', destination: 'Varkala', startDate: '2026-12-07', endDate: '2026-12-10' }),
    makeJourney({ id: 'v2', destination: '  varkala ', startDate: '2026-12-07T00:00:00Z', endDate: '2026-12-10' }),
    makeJourney({ id: 'k1', destination: 'Kedarnath', startDate: '2026-05-04', endDate: '2026-05-07' }),
    makeJourney({ id: 'k2', destination: 'Kedarnath', startDate: '2026-05-04', endDate: '2026-05-07' }),
    makeJourney({ id: 'b1', destination: 'Bangalore', startDate: '2026-10-08', endDate: '2026-10-11' }),
    makeJourney({ id: 'b2', destination: 'bangalore', startDate: '2026-10-08', endDate: '2026-10-18' }),
    makeJourney({ id: 'm1', destination: 'Munnar', startDate: '2026-11-01', endDate: '2026-11-03' }),
    makeJourney({ id: 'm2', destination: 'Munnar', startDate: '2026-11-04', endDate: '2026-11-06' }),
  ];

  const grouped = groupDuplicateTrips(journeys);
  assert.equal(grouped.exactGroups.length, 2);
  assert.equal(grouped.similarGroups.length, 1);
  assert.equal(grouped.totalSets, 3);
  assert.deepEqual(
    grouped.similarGroups[0].trips.map((t) => t.id),
    ['b1', 'b2']
  );

  // Adjacent non-overlapping dates never overlap
  assert.equal(datesOverlap('2026-10-08', '2026-10-11', '2026-10-12', '2026-10-15'), false);
  assert.equal(datesOverlap('2026-10-08', '2026-10-11', '2026-10-08', '2026-10-18'), true);
});

test('groupDuplicateTrips returns zero sets when no duplicates or overlaps exist', () => {
  const unique = [
    makeJourney({ id: 'a', destination: 'Goa', startDate: '2026-12-01', endDate: '2026-12-03' }),
    makeJourney({ id: 'b', destination: 'Goa', startDate: '2026-12-04', endDate: '2026-12-06' }),
    makeJourney({ id: 'c', destination: 'Jaipur', startDate: '2026-12-01', endDate: '2026-12-03' }),
  ];
  const grouped = groupDuplicateTrips(unique);
  assert.equal(grouped.exactGroups.length, 0);
  assert.equal(grouped.similarGroups.length, 0);
  assert.equal(grouped.totalSets, 0);
});

test('pickMostCompleteTripId favors most items, done marks, and edits regardless of array position', () => {
  const draftNew = makeJourney({
    id: 'new_draft',
    createdAt: '2026-11-20T10:00:00Z',
    editCount: 0,
    itinerary: [{ day: 1, date: '2026-12-07', location: 'Varkala', title: 'D1', activities: [{ id: '1', time: '', title: 'Cliff', type: 'activity', duration: '', status: 'unbooked', done: false }] }],
  });
  const richOlder = makeJourney({
    id: 'rich_old',
    createdAt: '2026-11-10T10:00:00Z',
    editCount: 3,
    itinerary: [
      {
        day: 1,
        date: '2026-12-07',
        location: 'Varkala',
        title: 'D1',
        activities: [
          { id: '1', time: '', title: 'Cliff', type: 'activity', duration: '', status: 'unbooked', done: true },
          { id: '2', time: '', title: 'Temple', type: 'activity', duration: '', status: 'unbooked', done: true },
          { id: '3', time: '', title: 'Sunset', type: 'activity', duration: '', status: 'unbooked', done: false },
        ],
      },
    ],
  });

  assert.equal(pickMostCompleteTripId([draftNew, richOlder]), 'rich_old');
  assert.equal(pickMostCompleteTripId([makeJourney({ id: 'e1' }), makeJourney({ id: 'e2' })]), null);
});

test('validateGroupKeepSelection blocks deleting all trips in a group and defaults to nothing deleted', () => {
  const t1 = makeJourney({ id: 't1' });
  const t2 = makeJourney({ id: 't2' });

  // Default: all kept -> nothing selected for deletion
  const allKept = validateGroupKeepSelection([t1, t2], new Set(['t1', 't2']));
  assert.equal(allKept.valid, false);
  assert.equal(allKept.deleteTrips.length, 0);

  // Attempt to uncheck all trips -> blocked
  const noneKept = validateGroupKeepSelection([t1, t2], new Set());
  assert.equal(noneKept.valid, false);
  assert.match(noneKept.reason || '', /At least one trip must remain kept/i);

  // Keeping 1 and deleting 1 -> allowed
  const oneKept = validateGroupKeepSelection([t1, t2], new Set(['t1']));
  assert.equal(oneKept.valid, true);
  assert.deepEqual(oneKept.keptTrips.map((t) => t.id), ['t1']);
  assert.deepEqual(oneKept.deleteTrips.map((t) => t.id), ['t2']);
});

test('trips with confirmed Duffel bookings require extra confirmation in addition to undo ack', () => {
  const plainTrip = makeJourney({ id: 'plain', flightBookingsCount: 0, bookings: [] });
  const bookedTrip = makeJourney({ id: 'booked', flightBookingsCount: 1, bookings: ['b_1'] });

  const reqPlain = getDeletionConfirmationRequirements([plainTrip]);
  assert.equal(reqPlain.requiresExtraBookingConfirm, false);
  assert.equal(canConfirmPermanentDelete({ ackCannotUndo: false, extraBookingConfirm: false }, [plainTrip]), false);
  assert.equal(canConfirmPermanentDelete({ ackCannotUndo: true, extraBookingConfirm: false }, [plainTrip]), true);

  const reqBooked = getDeletionConfirmationRequirements([bookedTrip]);
  assert.equal(reqBooked.requiresExtraBookingConfirm, true);
  assert.equal(canConfirmPermanentDelete({ ackCannotUndo: true, extraBookingConfirm: false }, [bookedTrip]), false);
  assert.equal(canConfirmPermanentDelete({ ackCannotUndo: true, extraBookingConfirm: true }, [bookedTrip]), true);
});

test('deleteTripsSequentially deletes in order and reports partial errors cleanly', async () => {
  const trips = [
    makeJourney({ id: 't1', title: 'Trip One' }),
    makeJourney({ id: 't2', title: 'Trip Two' }),
    makeJourney({ id: 't3', title: 'Trip Three' }),
  ];
  const calls = [];
  const outcome = await deleteTripsSequentially(trips, async (id) => {
    calls.push(id);
    if (id === 't2') throw new Error('Simulated 500 error');
  });

  assert.deepEqual(calls, ['t1', 't2', 't3']);
  assert.deepEqual(outcome.succeededIds, ['t1', 't3']);
  assert.equal(outcome.failedItems.length, 1);
  assert.equal(outcome.failedItems[0].id, 't2');
  assert.match(outcome.failedItems[0].error || '', /Simulated 500/);
});

test('session dismissal helpers store dismissal per session cleanly', () => {
  const store = new Map();
  const mockStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, v); },
  };
  assert.equal(readDuplicateNoticeDismissed(mockStorage), false);
  writeDuplicateNoticeDismissed(mockStorage, true);
  assert.equal(readDuplicateNoticeDismissed(mockStorage), true);
});

test('DuplicateReviewModal & PermanentDeleteConfirmModal render Most complete, Similar trips, counts, and safety checkboxes', () => {
  const duplicateLib = {
    getTripSummaryMetrics,
    validateGroupKeepSelection,
    getDeletionConfirmationRequirements,
    canConfirmPermanentDelete,
  };
  const DuplicateReviewModal = loadTsxComponent('components/trips/DuplicateReviewModal.tsx', {
    '../../lib/duplicateTrips': duplicateLib,
  });
  const PermanentDeleteConfirmModal = loadTsxComponent('components/trips/PermanentDeleteConfirmModal.tsx', {
    '../../lib/duplicateTrips': duplicateLib,
  });

  const v1 = makeJourney({
    id: 'v1',
    destination: 'Varkala',
    title: 'Varkala Detailed',
    startDate: '2026-12-07',
    endDate: '2026-12-10',
    editCount: 2,
    itinerary: [{ day: 1, date: '2026-12-07', location: 'Varkala', title: 'D1', activities: [{ id: 'a1', time: '', title: 'Cliff', type: 'activity', duration: '', status: 'unbooked', done: true }] }],
  });
  const v2 = makeJourney({
    id: 'v2',
    destination: 'Varkala',
    title: 'Varkala Draft',
    startDate: '2026-12-07',
    endDate: '2026-12-10',
    flightBookingsCount: 1,
    bookings: ['bk_1'],
  });
  const b1 = makeJourney({ id: 'b1', destination: 'Bangalore', title: 'BLR 1', startDate: '2026-10-08', endDate: '2026-10-11' });
  const b2 = makeJourney({ id: 'b2', destination: 'Bangalore', title: 'BLR 2', startDate: '2026-10-08', endDate: '2026-10-18' });

  const grouped = groupDuplicateTrips([v1, v2, b1, b2]);
  const reviewHtml = renderToStaticMarkup(
    React.createElement(DuplicateReviewModal, {
      open: true,
      exactGroups: grouped.exactGroups,
      similarGroups: grouped.similarGroups,
      extrasByTripId: { v1: { expensesCount: 4 } },
      loadingExtras: false,
      lastOutcome: null,
      onRequestDeleteGroup: () => {},
      onClose: () => {},
    })
  );

  assert.match(reviewHtml, /Most complete/);
  assert.match(reviewHtml, /Similar trips/);
  assert.match(reviewHtml, /Varkala Detailed/);
  assert.match(reviewHtml, /Keep this trip/);
  // All trips checked by default -> Delete button starts disabled
  assert.match(reviewHtml, /disabled=""[^>]*>Delete the others<\/button>/);

  const confirmHtml = renderToStaticMarkup(
    React.createElement(PermanentDeleteConfirmModal, {
      open: true,
      title: 'Delete selected duplicate trips',
      subtitle: 'Confirm removal',
      keepTrips: [v1],
      deleteTrips: [v2],
      extrasByTripId: { v2: { expensesCount: 2 } },
      loadingExtras: false,
      isDeleting: false,
      outcome: null,
      onCancel: () => {},
      onConfirm: async () => {},
    })
  );

  assert.match(confirmHtml, /2<\/strong> expenses/);
  assert.match(confirmHtml, /unknown<\/strong> chat messages/);
  assert.match(confirmHtml, /Confirmed Duffel flight booking warning/);
  assert.match(confirmHtml, /I understand this can&#x27;t be undone/);
});

