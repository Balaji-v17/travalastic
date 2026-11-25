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
  PASSENGER_LIMITS,
  HOTEL_LIMITS,
  PLANNER_LIMITS,
  BOOKING_FLOW_LIMITS,
  clampCount,
  stepCount,
  stepFlightPassengers,
  stepHotelGuestsAndRooms,
} from '../src/lib/countLimits.ts';
import { buildBookingUrl } from '../src/lib/stay.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_SRC_DIR = path.resolve(__dirname, '../src');
const require = createRequire(import.meta.url);

function loadCountStepperComponent() {
  const filePath = path.join(WEB_SRC_DIR, 'components/common/CountStepper.tsx');
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
    if (specifier === '../../lib/countLimits') {
      return { PASSENGER_LIMITS, HOTEL_LIMITS, PLANNER_LIMITS, BOOKING_FLOW_LIMITS, clampCount, stepCount };
    }
    return require(specifier);
  };
  const fn = new Function('require', 'module', 'exports', transpiled.outputText);
  fn(localRequire, mod, mod.exports);
  return mod.exports.default;
}

function collectTsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

test('Pure stepper math: stepCount, clampCount, flights & hotels rules', async (t) => {
  await t.test('clampCount & stepCount obey min and max boundaries', () => {
    assert.equal(clampCount(0, 1, 9), 1);
    assert.equal(clampCount(15, 1, 9), 9);
    assert.equal(stepCount(1, -1, 1, 9), 1);
    assert.equal(stepCount(1, 1, 1, 9), 2);
    assert.equal(stepCount(9, 1, 1, 9), 9);
  });

  await t.test('stepFlightPassengers enforces infants <= adults and total <= 9', () => {
    assert.equal(PASSENGER_LIMITS.maxTotal, 9);

    let counts = { adults: 2, children: 0, infants: 2 };
    counts = stepFlightPassengers(counts, 'infants', 1);
    assert.deepEqual(counts, { adults: 2, children: 0, infants: 2 });

    // Reducing adults below infants clamps infants down cleanly
    counts = stepFlightPassengers(counts, 'adults', -1);
    assert.deepEqual(counts, { adults: 1, children: 0, infants: 1 });

    // Cannot go below 1 adult
    counts = stepFlightPassengers(counts, 'adults', -1);
    assert.deepEqual(counts, { adults: 1, children: 0, infants: 1 });

    // Cannot exceed total 9 passengers
    counts = stepFlightPassengers({ adults: 5, children: 4, infants: 0 }, 'adults', 1);
    assert.deepEqual(counts, { adults: 5, children: 4, infants: 0 });
  });

  await t.test('stepHotelGuestsAndRooms enforces guests 1-9, rooms 1-5, and rooms <= guests', () => {
    assert.equal(HOTEL_LIMITS.maxGuests, 9);
    assert.equal(HOTEL_LIMITS.maxRooms, 5);

    // Increasing rooms capped by current guests
    let state = stepHotelGuestsAndRooms({ guests: 2, rooms: 2 }, 'rooms', 1);
    assert.deepEqual(state, { guests: 2, rooms: 2, roomsAdjusted: false });

    // Decreasing guests below rooms lowers rooms and flags roomsAdjusted
    state = stepHotelGuestsAndRooms({ guests: 3, rooms: 3 }, 'guests', -1);
    assert.deepEqual(state, { guests: 2, rooms: 2, roomsAdjusted: true });

    // Rooms cannot exceed HOTEL_LIMITS.maxRooms (5) even when guests are 9
    state = stepHotelGuestsAndRooms({ guests: 9, rooms: 5 }, 'rooms', 1);
    assert.deepEqual(state, { guests: 9, rooms: 5, roomsAdjusted: false });
  });

  await t.test('Booking.com URL preserves selected guests (9) and rooms (3)', () => {
    const url = buildBookingUrl({
      destination: 'Kyoto',
      checkIn: '2026-12-01',
      checkOut: '2026-12-05',
      guests: 9,
      rooms: 3,
    });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('group_adults'), '9');
    assert.equal(parsed.searchParams.get('no_rooms'), '3');
  });
});

test('CountStepper component renders accessible controls, disabled states, live region & arrow keys', () => {
  const CountStepper = loadCountStepperComponent();

  const htmlAtMin = renderToStaticMarkup(
    React.createElement(CountStepper, {
      label: 'Guests',
      value: 1,
      min: 1,
      max: 9,
      onChange: () => {},
    })
  );
  assert.match(htmlAtMin, /role="group"/);
  assert.match(htmlAtMin, /aria-label="Decrease guests"/);
  assert.match(htmlAtMin, /aria-label="Increase guests"/);
  assert.match(htmlAtMin, /aria-live="polite"/);
  assert.match(htmlAtMin, /min-w-\[44px\] min-h-\[44px\]/);
  assert.match(htmlAtMin, /<button[^>]*\bdisabled=""[^>]*aria-label="Decrease guests"|<button[^>]*aria-label="Decrease guests"[^>]*\bdisabled=""/);
  assert.doesNotMatch(htmlAtMin, /<button[^>]*\bdisabled=""[^>]*aria-label="Increase guests"|<button[^>]*aria-label="Increase guests"[^>]*\bdisabled=""/);
  assert.doesNotMatch(htmlAtMin, /<input|<select/);

  const htmlAtMax = renderToStaticMarkup(
    React.createElement(CountStepper, {
      label: 'Travelers',
      value: 9,
      min: 1,
      max: 9,
      onChange: () => {},
      helperText: PASSENGER_LIMITS.capHelperText,
    })
  );
  assert.match(htmlAtMax, /<button[^>]*\bdisabled=""[^>]*aria-label="Increase travelers"|<button[^>]*aria-label="Increase travelers"[^>]*\bdisabled=""/);
  assert.match(htmlAtMax, /Airlines allow up to 9 passengers per booking/);

  const rawSource = fs.readFileSync(
    path.join(WEB_SRC_DIR, 'components/common/CountStepper.tsx'),
    'utf8'
  );
  assert.match(rawSource, /ArrowUp/);
  assert.match(rawSource, /ArrowDown/);
});

test('No <select> dropdown remains for people or room counts in Step A1 web files', () => {
  const convertedFiles = [
    'pages/traveler/HomePage.tsx',
    'pages/traveler/SearchPage.tsx',
    'pages/traveler/HotelsPage.tsx',
    'pages/traveler/booking/HotelBookingFlow.tsx',
    'pages/traveler/booking/ExperienceBookingFlow.tsx',
  ];

  for (const rel of convertedFiles) {
    const content = fs.readFileSync(path.join(WEB_SRC_DIR, rel), 'utf8');
    // Match <select blocks whose nearby body references guest/adult/room/traveler counts
    const selectBlocks = content.match(/<select[\s\S]*?<\/select>/g) || [];
    for (const block of selectBlocks) {
      assert.equal(
        /\b(hotelGuests|hotelRooms|flightAdults|guestCount|setAdults|setGuests|setRooms|setFlightAdults|setGuestCount)\b/.test(
          block
        ),
        false,
        `Found remaining count <select> in ${rel}`
      );
    }
  }

  // AIPlannerPage travelers must use CountStepper (only non-count selects like nights/dates/etc. may exist)
  const plannerContent = fs.readFileSync(
    path.join(WEB_SRC_DIR, 'pages/traveler/AIPlannerPage.tsx'),
    'utf8'
  );
  assert.match(plannerContent, /<CountStepper[\s\S]*dna\.travelers/);
  const plannerSelects = plannerContent.match(/<select[\s\S]*?<\/select>/g) || [];
  for (const block of plannerSelects) {
    assert.equal(
      /\bdna\.travelers\b/.test(block),
      false,
      'AIPlannerPage.tsx still has a <select> for dna.travelers'
    );
  }
});
