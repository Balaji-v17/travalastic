import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PASSENGER_LIMITS,
  HOTEL_LIMITS,
  clampCount,
  stepCount,
  stepFlightPassengers,
  stepHotelGuestsAndRooms,
} from '../src/constants/countLimits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_DIR = path.resolve(__dirname, '..');

describe('Mobile CountStepper limits, pure logic & accessibility', () => {
  it('enforces PASSENGER_LIMITS and stepFlightPassengers constraints', () => {
    assert.equal(PASSENGER_LIMITS.minAdults, 1);
    assert.equal(PASSENGER_LIMITS.maxTotal, 9);

    assert.equal(clampCount(0, 1, 9), 1);
    assert.equal(clampCount(12, 1, 9), 9);
    assert.equal(stepCount(1, -1, 1, 9), 1);
    assert.equal(stepCount(8, 1, 1, 9), 9);
    assert.equal(stepCount(9, 1, 1, 9), 9);

    const lowered = stepFlightPassengers(
      { adults: 2, children: 0, infants: 2 },
      'adults',
      -1
    );
    assert.deepEqual(lowered, { adults: 1, children: 0, infants: 1 });

    const capped = stepFlightPassengers(
      { adults: 9, children: 0, infants: 0 },
      'adults',
      1
    );
    assert.deepEqual(capped, { adults: 9, children: 0, infants: 0 });
  });

  it('enforces HOTEL_LIMITS and stepHotelGuestsAndRooms rules', () => {
    assert.equal(HOTEL_LIMITS.maxGuests, 9);
    assert.equal(HOTEL_LIMITS.maxRooms, 5);

    const adjusted = stepHotelGuestsAndRooms(
      { guests: 2, rooms: 2 },
      'guests',
      -1
    );
    assert.deepEqual(adjusted, { guests: 1, rooms: 1, roomsAdjusted: true });
  });

  it('CountStepper.js defines >=44px targets and required accessibility attributes', () => {
    const src = fs.readFileSync(
      path.join(MOBILE_DIR, 'src/components/CountStepper.js'),
      'utf8'
    );
    assert.match(src, /minWidth:\s*44/);
    assert.match(src, /minHeight:\s*44/);
    assert.match(src, /accessibilityRole="button"/);
    assert.match(src, /Decrease \$\{lowerLabel\}/);
    assert.match(src, /Increase \$\{lowerLabel\}/);
    assert.match(src, /accessibilityLiveRegion="polite"/);
    assert.doesNotMatch(src, /<TextInput/);
  });

  it('FlightSearchScreen.js uses shared CountStepper and PASSENGER_LIMITS without Picker/Select', () => {
    const screenSrc = fs.readFileSync(
      path.join(MOBILE_DIR, 'src/screens/FlightSearchScreen.js'),
      'utf8'
    );
    assert.match(screenSrc, /<CountStepper/);
    assert.match(screenSrc, /PASSENGER_LIMITS\.maxTotal/);
    assert.doesNotMatch(screenSrc, /<Picker|<select/);
  });
});

