import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tripStatus,
  tripHasBooking,
  getLocalDateString,
  normalizeDateString,
  getBookablePlanItems,
} from '../src/lib/tripStatus.ts';
import { deriveStatus, toJourney } from '../src/lib/journeyAdapter.ts';
import { computeTripDates, buildRawRequest } from '../src/lib/itineraryApi.ts';

describe('Trip Status Pure Logic (Web)', () => {
  const fixedToday = '2026-11-23';

  describe('tripHasBooking', () => {
    it('returns false for null, empty or booking-less trips', () => {
      assert.equal(tripHasBooking(null), false);
      assert.equal(tripHasBooking({}), false);
      assert.equal(tripHasBooking({ bookings: [] }), false);
      assert.equal(tripHasBooking({ bookingsCount: 0 }), false);
      assert.equal(tripHasBooking({ hasBooking: false }), false);
    });

    it('returns true when hasBooking is true or bookings array has items or bookingsCount > 0', () => {
      assert.equal(tripHasBooking({ hasBooking: true }), true);
      assert.equal(tripHasBooking({ bookings: ['booking-1'] }), true);
      assert.equal(tripHasBooking({ bookingsCount: 1 }), true);
    });
  });

  describe('tripStatus state machine', () => {
    it('planning: no confirmed booking AND end date >= today', () => {
      assert.equal(
        tripStatus({ startDate: '2026-12-07', endDate: '2026-12-10', hasBooking: false }, fixedToday),
        'planning'
      );
      assert.equal(
        tripStatus({ startDate: '2026-11-20', endDate: '2026-11-23', hasBooking: false }, fixedToday),
        'planning'
      );
      assert.equal(
        tripStatus({ startDate: '2026-12-01', hasBooking: false }, fixedToday),
        'planning'
      );
    });

    it('past: no confirmed booking AND end date < today (NEVER completed)', () => {
      assert.equal(
        tripStatus({ startDate: '2026-08-10', endDate: '2026-08-13', hasBooking: false }, fixedToday),
        'past'
      );
      assert.equal(
        tripStatus({ startDate: '2026-11-18', endDate: '2026-11-22', bookings: [] }, fixedToday),
        'past'
      );
    });

    it('upcoming: at least one confirmed booking AND start date > today', () => {
      assert.equal(
        tripStatus({ startDate: '2026-11-24', endDate: '2026-11-30', hasBooking: true }, fixedToday),
        'upcoming'
      );
      assert.equal(
        tripStatus({ startDate: '2027-05-04', endDate: '2027-05-07', bookingsCount: 1 }, fixedToday),
        'upcoming'
      );
    });

    it('in-progress: at least one confirmed booking AND start <= today <= end', () => {
      // Starts today
      assert.equal(
        tripStatus({ startDate: '2026-11-23', endDate: '2026-11-28', hasBooking: true }, fixedToday),
        'in-progress'
      );
      // Middle of trip
      assert.equal(
        tripStatus({ startDate: '2026-11-20', endDate: '2026-11-25', hasBooking: true }, fixedToday),
        'in-progress'
      );
      // Ends today
      assert.equal(
        tripStatus({ startDate: '2026-11-20', endDate: '2026-11-23', hasBooking: true }, fixedToday),
        'in-progress'
      );
    });

    it('completed: at least one confirmed booking AND end date < today', () => {
      assert.equal(
        tripStatus({ startDate: '2026-11-15', endDate: '2026-11-20', hasBooking: true }, fixedToday),
        'completed'
      );
    });
  });

  describe('deriveStatus and toJourney integration', () => {
    it('deriveStatus delegates to tripStatus correctly', () => {
      assert.equal(deriveStatus('2026-08-10', '2026-08-13', fixedToday, false), 'past');
      assert.equal(deriveStatus('2026-08-10', '2026-08-13', fixedToday, true), 'completed');
      assert.equal(deriveStatus('2026-12-07', '2026-12-10', fixedToday, false), 'planning');
      assert.equal(deriveStatus('2026-12-07', '2026-12-10', fixedToday, true), 'upcoming');
    });

    it('toJourney marks past trip with no bookings as past', () => {
      const journey = toJourney({
        _id: 'itin-past-1',
        destination: 'Jog Falls',
        startDate: '2026-08-10',
        endDate: '2026-08-13',
        days: [],
      }, []);

      assert.equal(journey.status, 'past');
    });

    it('toJourney marks future trip with bookings as upcoming', () => {
      const journey = toJourney({
        _id: 'itin-future-1',
        destination: 'Goa',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        days: [],
      }, [{ _id: 'b-1', type: 'flight' }]);

      assert.equal(journey.status, 'upcoming');
    });
  });
});

describe('Pre-generation Duplicate Date Computation', () => {
  it('computeTripDates adds nights correctly without timezone offsets', () => {
    const dates = computeTripDates('2026-12-07', 3);
    assert.equal(dates.startDate, '2026-12-07');
    assert.equal(dates.endDate, '2026-12-10');
  });

  it('buildRawRequest builds normalized prompt with exact dates', () => {
    const prompt = buildRawRequest({
      destination: 'Varkala, Kerala',
      destinationId: 'varkala',
      origin: 'Bengaluru',
      startDate: '2026-12-07',
      nights: 3,
      travelers: 2,
      budget: 15000,
      pace: 'relaxed',
      comfort: 'comfortable',
      interests: ['beaches'],
      mustHave: '',
      avoid: '',
      notes: '',
    });

    assert.ok(prompt.includes('Plan a 3-day trip to Varkala, Kerala from 2026-12-07 to 2026-12-10.'));
  });
});

describe('Continue Planning Bookable Items Filtering', () => {
  it('strictly excludes places, meals, and rest/free time, while keeping stays and transit', () => {
    const sampleJourney = {
      id: 'trip-1',
      destination: 'Goa',
      startDate: '2026-12-07',
      endDate: '2026-12-10',
      itinerary: [
        {
          day: 1,
          date: '2026-12-07',
          location: 'Goa',
          title: 'Day 1',
          accommodationSuggestion: 'Stay: Cozy guesthouse near Palolem',
          activities: [
            {
              id: 'a1',
              title: 'Flight to Goa Dabolim',
              type: 'flight',
              kind: 'transit',
              status: 'unbooked',
            },
            {
              id: 'a2',
              title: 'Visit Aguada Fort',
              type: 'activity',
              kind: 'place',
              status: 'unbooked',
            },
            {
              id: 'a3',
              title: 'Lunch at Beach Shack',
              type: 'meal',
              kind: 'meal',
              status: 'unbooked',
            },
            {
              id: 'a4',
              title: 'Sunset at Palolem Beach',
              type: 'activity',
              kind: 'place',
              status: 'unbooked',
            },
            {
              id: 'a5',
              title: 'Evening free time',
              type: 'free',
              kind: 'rest',
              status: 'unbooked',
            },
          ],
        },
      ],
    };

    const bookable = getBookablePlanItems(sampleJourney);

    // Only stay and flight should be returned
    assert.equal(bookable.length, 2);
    assert.equal(bookable[0].title, 'Stay: Cozy guesthouse near Palolem');
    assert.equal(bookable[0].type, 'hotel');
    assert.equal(bookable[1].title, 'Flight to Goa Dabolim');
    assert.equal(bookable[1].type, 'flight');

    // Never includes meals, places or rest
    const titles = bookable.map((b) => b.title);
    assert.ok(!titles.includes('Visit Aguada Fort'));
    assert.ok(!titles.includes('Lunch at Beach Shack'));
    assert.ok(!titles.includes('Evening free time'));
  });

  it('Kedarnath-style trip: keeps helicopter/transit and accommodation, excludes temple and lunch', () => {
    const kedarnathJourney = {
      id: 'trip-kedarnath',
      destination: 'Kedarnath',
      startDate: '2027-05-04',
      endDate: '2027-05-07',
      itinerary: [
        {
          day: 1,
          date: '2027-05-04',
          location: 'Kedarnath',
          title: 'Day 1',
          accommodationSuggestion: 'GMVN Kedarnath Cottages',
          activities: [
            {
              id: 'k1',
              title: 'Helicopter transfer from Phata to Kedarnath',
              type: 'transfer',
              kind: 'transit',
              status: 'unbooked',
            },
            {
              id: 'k2',
              title: 'Visit Kedarnath Temple',
              type: 'activity',
              kind: 'place',
              status: 'unbooked',
            },
            {
              id: 'k3',
              title: 'Lunch Break',
              type: 'meal',
              kind: 'meal',
              status: 'unbooked',
            },
          ],
        },
      ],
    };

    const bookable = getBookablePlanItems(kedarnathJourney);
    assert.equal(bookable.length, 2);
    assert.equal(bookable[0].title, 'Stay: GMVN Kedarnath Cottages');
    assert.equal(bookable[1].title, 'Helicopter transfer from Phata to Kedarnath');

    const titles = bookable.map((b) => b.title);
    assert.ok(!titles.includes('Visit Kedarnath Temple'));
    assert.ok(!titles.includes('Lunch Break'));
  });

  it('returns empty array when no bookable stays or transit exist', () => {
    const sightSeeingOnly = {
      id: 'trip-sightseeing',
      destination: 'Hampi',
      itinerary: [
        {
          day: 1,
          date: '2026-12-01',
          location: 'Hampi',
          title: 'Day 1',
          activities: [
            { id: 'h1', title: 'Virupaksha Temple', type: 'activity', kind: 'place', status: 'unbooked' },
            { id: 'h2', title: 'Local Thali Lunch', type: 'meal', kind: 'meal', status: 'unbooked' },
          ],
        },
      ],
    };

    const bookable = getBookablePlanItems(sightSeeingOnly);
    assert.equal(bookable.length, 0);
  });
});

describe('Delete Dialogs & Replace Undo Verification (Web)', () => {
  it('verifies exact deletion notice copy for child resources and unlinked bookings', async () => {
    const fs = await import('node:fs');
    const myTripsContent = fs.readFileSync('src/pages/traveler/MyTripsPage.tsx', 'utf8');
    const confirmModalContent = fs.readFileSync('src/components/trips/PermanentDeleteConfirmModal.tsx', 'utf8');

    assert.ok(myTripsContent.includes('PermanentDeleteConfirmModal'), 'MyTripsPage must use PermanentDeleteConfirmModal for duplicate & past clearing');
    assert.ok(myTripsContent.includes('handleOpenClearPastModal'), 'Clear past trips must open shared PermanentDeleteConfirmModal');
    assert.ok(
      confirmModalContent.includes('AI chat history, expenses, packing data, and disruption alerts'),
      'Must state permanent deletion of chat, expenses, packing, and disruptions'
    );
    assert.ok(
      confirmModalContent.includes('Flight bookings made through Travalastic and recorded bookings are kept in your Bookings history'),
      'Must state flight and recorded bookings are kept and detached'
    );
    assert.ok(
      confirmModalContent.includes("I understand this can't be undone.") ||
        confirmModalContent.includes('I understand this can&apos;t be undone.'),
      'Must require non-undoable acknowledgement checkbox'
    );
  });

  it('verifies replace warning copy in AIPlannerPage duplicate modal', async () => {
    const fs = await import('node:fs');
    const plannerContent = fs.readFileSync('src/pages/traveler/AIPlannerPage.tsx', 'utf8');

    const expectedWarning = 'Replacing will overwrite your existing schedule, done-marks, and chat edits with the new plan.';
    const expectedUndoNotice = 'You will be able to undo this replace afterwards';

    assert.ok(plannerContent.includes(expectedWarning), 'Replace modal must warn that schedule, done-marks and chat edits are replaced');
    assert.ok(plannerContent.includes(expectedUndoNotice), 'Replace modal must state that replace can be undone');

    // Check undo replace banner presence
    assert.ok(plannerContent.includes('↩ Undo Replace'), 'Generated result phase must display Undo Replace button');
    assert.ok(plannerContent.includes('Replaced previous itinerary'), 'Top banner must indicate previous itinerary was replaced');
  });
});

