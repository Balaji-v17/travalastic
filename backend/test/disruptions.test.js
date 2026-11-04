import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Disruption from '../src/models/Disruption.js';
import {
  computeFlightDelay,
  mapDelayToOption,
  findAffectedDay,
  classifyDisruption,
  buildDedupeKey,
  DELAY_THRESHOLD_MIN,
  DELAY_THRESHOLD_30_MAX,
  DELAY_THRESHOLD_60_MAX,
  DELAY_THRESHOLD_120_MAX,
  DELAY_THRESHOLD_180_MIN,
  DELAY_THRESHOLD_CAPPED,
} from '../src/services/disruptions/analysis.js';
import { countUserData, deleteUserAndData } from '../src/services/accountDeletion.js';

describe('Disruption Model & Pure Analysis Engine', () => {
  describe('Disruption Mongoose Model Schema & Indexes', () => {
    it('instantiates valid Disruption document with default values', () => {
      const validData = {
        userId: new mongoose.Types.ObjectId(),
        itineraryId: new mongoose.Types.ObjectId(),
        type: 'flight_schedule_change',
        source: 'duffel_webhook',
        dedupeKey: 'ord_123:chg_456',
        details: {
          oldDeparture: '2026-11-01T08:00:00',
          newDeparture: '2026-11-01T08:45:00',
          oldArrival: '2026-11-01T10:30:00',
          newArrival: '2026-11-01T11:15:00',
          delayMinutes: 45,
          structural: false,
        },
      };

      const doc = new Disruption(validData);
      assert.strictEqual(doc.status, 'new');
      assert.strictEqual(doc.proposal, null);
      assert.strictEqual(doc.appliedEditId, null);
      assert.strictEqual(doc.bookingId, null);
      assert.strictEqual(doc.details.delayMinutes, 45);
      assert.strictEqual(doc.details.structural, false);
      assert.ok(doc.detectedAt instanceof Date);

      const validationError = doc.validateSync();
      assert.strictEqual(validationError, undefined);
    });

    it('rejects invalid type or source and requires mandatory fields', () => {
      const invalidDoc = new Disruption({
        type: 'train_delay',
        source: 'random_source',
      });

      const err = invalidDoc.validateSync();
      assert.ok(err);
      assert.ok(err.errors.userId, 'userId should be required');
      assert.ok(err.errors.itineraryId, 'itineraryId should be required');
      assert.ok(err.errors.dedupeKey, 'dedupeKey should be required');
      assert.ok(err.errors.type, 'type should be invalid enum');
      assert.ok(err.errors.source, 'source should be invalid enum');
    });

    it('defines compound indexes for status lookup and unique deduplication', () => {
      const indexes = Disruption.schema.indexes();

      const hasStatusIndex = indexes.some(([fields]) => {
        return fields.userId === 1 && fields.status === 1 && fields.createdAt === 1;
      });
      assert.ok(hasStatusIndex, 'Index on { userId, status, createdAt } must be present');

      const hasUniqueDedupeIndex = indexes.some(([fields, options]) => {
        return fields.userId === 1 && fields.dedupeKey === 1 && options?.unique === true;
      });
      assert.ok(hasUniqueDedupeIndex, 'Unique compound index on { userId, dedupeKey } must be present');
    });
  });

  describe('buildDedupeKey pure function', () => {
    it('creates formatted deterministic dedupe key', () => {
      assert.strictEqual(buildDedupeKey('ord_abc', 'chg_xyz'), 'ord_abc:chg_xyz');
      assert.strictEqual(buildDedupeKey('  ord_999  ', '  chg_888  '), 'ord_999:chg_888');
      assert.strictEqual(buildDedupeKey('', ''), ':');
    });
  });

  describe('computeFlightDelay pure function & Fixtures', () => {
    it('fixture: a 45-minute delay', () => {
      const oldSegments = [
        {
          origin: { iata_code: 'BLR' },
          destination: { iata_code: 'GOI' },
          departing_at: '2026-11-01T10:00:00',
          arriving_at: '2026-11-01T11:15:00',
        },
      ];
      const newSegments = [
        {
          origin: { iata_code: 'BLR' },
          destination: { iata_code: 'GOI' },
          departing_at: '2026-11-01T10:45:00',
          arriving_at: '2026-11-01T12:00:00', // 45 min delay
        },
      ];

      const res = computeFlightDelay(oldSegments, newSegments);
      assert.strictEqual(res.changed, true);
      assert.strictEqual(res.structural, false);
      assert.strictEqual(res.delayMinutes, 45);
      assert.strictEqual(res.departureShiftMinutes, 45);
    });

    it('fixture: an early arrival (negative delay)', () => {
      const oldSegments = [
        {
          origin: 'DEL',
          destination: 'BOM',
          departing_at: '2026-11-01T14:00:00',
          arriving_at: '2026-11-01T16:15:00',
        },
      ];
      const newSegments = [
        {
          origin: 'DEL',
          destination: 'BOM',
          departing_at: '2026-11-01T13:40:00',
          arriving_at: '2026-11-01T15:55:00', // 20 minutes earlier
        },
      ];

      const res = computeFlightDelay(oldSegments, newSegments);
      assert.strictEqual(res.changed, true);
      assert.strictEqual(res.structural, false);
      assert.strictEqual(res.delayMinutes, -20);
      assert.strictEqual(res.departureShiftMinutes, -20);
    });

    it('fixture: under 15 minutes delay', () => {
      const oldSegments = [
        {
          origin: 'BOM',
          destination: 'GOI',
          departing_at: '2026-11-01T09:00:00',
          arriving_at: '2026-11-01T10:15:00',
        },
      ];
      const newSegments = [
        {
          origin: 'BOM',
          destination: 'GOI',
          departing_at: '2026-11-01T09:10:00',
          arriving_at: '2026-11-01T10:25:00', // 10 min delay
        },
      ];

      const res = computeFlightDelay(oldSegments, newSegments);
      assert.strictEqual(res.changed, true);
      assert.strictEqual(res.structural, false);
      assert.strictEqual(res.delayMinutes, 10);
      assert.strictEqual(res.departureShiftMinutes, 10);
    });

    it('fixture: structural change - segment count differs', () => {
      const oldSegments = [
        {
          origin: 'BOM',
          destination: 'DEL',
          departing_at: '2026-11-01T10:00:00',
          arriving_at: '2026-11-01T12:00:00',
        },
      ];
      const newSegments = [
        {
          origin: 'BOM',
          destination: 'JAI',
          departing_at: '2026-11-01T10:00:00',
          arriving_at: '2026-11-01T11:45:00',
        },
        {
          origin: 'JAI',
          destination: 'DEL',
          departing_at: '2026-11-01T12:30:00',
          arriving_at: '2026-11-01T13:45:00',
        },
      ];

      const res = computeFlightDelay(oldSegments, newSegments);
      assert.strictEqual(res.changed, true);
      assert.strictEqual(res.structural, true);
      assert.strictEqual(res.delayMinutes, null);
    });

    it('fixture: structural change - different airport code', () => {
      const oldSegments = [
        {
          origin: 'BOM',
          destination: 'DEL',
          departing_at: '2026-11-01T10:00:00',
          arriving_at: '2026-11-01T12:00:00',
        },
      ];
      const newSegments = [
        {
          origin: 'BOM',
          destination: 'BLR', // Rerouted to BLR instead of DEL
          departing_at: '2026-11-01T10:00:00',
          arriving_at: '2026-11-01T11:45:00',
        },
      ];

      const res = computeFlightDelay(oldSegments, newSegments);
      assert.strictEqual(res.changed, true);
      assert.strictEqual(res.structural, true);
      assert.strictEqual(res.delayMinutes, null);
    });

    it('fixture: a delay that pushes arrival past midnight into the next day', () => {
      const oldSegments = [
        {
          origin: 'DEL',
          destination: 'GOI',
          departing_at: '2026-11-01T21:00:00',
          arriving_at: '2026-11-01T23:30:00',
        },
      ];
      const newSegments = [
        {
          origin: 'DEL',
          destination: 'GOI',
          departing_at: '2026-11-01T22:15:00',
          arriving_at: '2026-11-02T00:45:00', // 75 min delay crossing midnight
        },
      ];

      const res = computeFlightDelay(oldSegments, newSegments);
      assert.strictEqual(res.changed, true);
      assert.strictEqual(res.structural, false);
      assert.strictEqual(res.delayMinutes, 75);
      assert.strictEqual(res.departureShiftMinutes, 75);
    });

    it('returns changed false when flight times and airports are identical', () => {
      const segments = [
        {
          origin: 'BLR',
          destination: 'BOM',
          departing_at: '2026-11-01T08:00:00',
          arriving_at: '2026-11-01T09:40:00',
        },
      ];

      const res = computeFlightDelay(segments, segments);
      assert.strictEqual(res.changed, false);
      assert.strictEqual(res.structural, false);
      assert.strictEqual(res.delayMinutes, 0);
      assert.strictEqual(res.departureShiftMinutes, 0);
    });
  });

  describe('mapDelayToOption pure function & Threshold Boundaries', () => {
    it('boundary: under 15 returns null (ignore)', () => {
      assert.strictEqual(mapDelayToOption(-10), null);
      assert.strictEqual(mapDelayToOption(0), null);
      assert.strictEqual(mapDelayToOption(10), null);
      assert.strictEqual(mapDelayToOption(14), null);
    });

    it('boundary: 14 / 15 threshold', () => {
      assert.strictEqual(mapDelayToOption(14), null);
      assert.deepStrictEqual(mapDelayToOption(15), { option: 30, capped: false });
    });

    it('boundary: 44 / 45 threshold', () => {
      assert.deepStrictEqual(mapDelayToOption(44), { option: 30, capped: false });
      assert.deepStrictEqual(mapDelayToOption(45), { option: 60, capped: false });
    });

    it('boundary: 89 / 90 threshold', () => {
      assert.deepStrictEqual(mapDelayToOption(89), { option: 60, capped: false });
      assert.deepStrictEqual(mapDelayToOption(90), { option: 120, capped: false });
    });

    it('boundary: 149 / 150 threshold', () => {
      assert.deepStrictEqual(mapDelayToOption(149), { option: 120, capped: false });
      assert.deepStrictEqual(mapDelayToOption(150), { option: 180, capped: false });
    });

    it('boundary: 180 / 181 threshold (capping at 180 min)', () => {
      assert.deepStrictEqual(mapDelayToOption(180), { option: 180, capped: false });
      assert.deepStrictEqual(mapDelayToOption(181), { option: 180, capped: true });
      assert.deepStrictEqual(mapDelayToOption(240), { option: 180, capped: true });
    });

    it('verifies named threshold constants', () => {
      assert.strictEqual(DELAY_THRESHOLD_MIN, 15);
      assert.strictEqual(DELAY_THRESHOLD_30_MAX, 44);
      assert.strictEqual(DELAY_THRESHOLD_60_MAX, 89);
      assert.strictEqual(DELAY_THRESHOLD_120_MAX, 149);
      assert.strictEqual(DELAY_THRESHOLD_180_MIN, 150);
      assert.strictEqual(DELAY_THRESHOLD_CAPPED, 180);
    });
  });

  describe('findAffectedDay pure function', () => {
    const itinerary = {
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      days: [
        { dayNumber: 1, activities: [] },
        { dayNumber: 2, activities: [] },
        { dayNumber: 3, activities: [] },
        { dayNumber: 4, activities: [] },
      ],
    };

    it('maps arrival on start date to Day 1', () => {
      assert.strictEqual(findAffectedDay(itinerary, '2026-11-01T14:30:00'), 1);
    });

    it('fixture: delay pushing arrival past midnight into the next day maps to Day 2', () => {
      assert.strictEqual(findAffectedDay(itinerary, '2026-11-02T00:30:00'), 2);
    });

    it('fixture: arrival date outside the trip returns null', () => {
      // Prior to start date
      assert.strictEqual(findAffectedDay(itinerary, '2026-10-31T22:00:00'), null);
      // After trip end date
      assert.strictEqual(findAffectedDay(itinerary, '2026-11-05T10:00:00'), null);
    });

    it('handles missing or malformed dates gracefully', () => {
      assert.strictEqual(findAffectedDay(null, '2026-11-01T10:00:00'), null);
      assert.strictEqual(findAffectedDay(itinerary, ''), null);
      assert.strictEqual(findAffectedDay(itinerary, 'invalid-date'), null);
    });
  });

  describe('classifyDisruption pure function & Actionability Scenarios', () => {
    const buildItinerary = (day1Done = false) => ({
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      days: [
        {
          dayNumber: 1,
          activities: [
            { title: 'Visit Fort Aguada', done: day1Done },
            { title: 'Calangute Beach Walk', done: day1Done },
          ],
        },
        {
          dayNumber: 2,
          activities: [
            { title: 'Dudhsagar Waterfalls', done: false },
          ],
        },
      ],
    });

    it('fixture: actionable 45-minute delay on day 1 with undone activities', () => {
      const itin = buildItinerary(false);
      const delayInfo = {
        changed: true,
        structural: false,
        delayMinutes: 45,
      };

      const result = classifyDisruption(itin, delayInfo, '2026-11-01T14:45:00');
      assert.deepStrictEqual(result, {
        actionable: true,
        reason: null,
        dayNumber: 1,
        option: 60,
        capped: false,
      });
    });

    it('fixture: delay under 15 minutes is not actionable', () => {
      const itin = buildItinerary(false);
      const delayInfo = {
        changed: true,
        structural: false,
        delayMinutes: 10,
      };

      const result = classifyDisruption(itin, delayInfo, '2026-11-01T14:10:00');
      assert.deepStrictEqual(result, {
        actionable: false,
        reason: 'delay under 15 minutes',
        dayNumber: 1,
        option: null,
        capped: false,
      });
    });

    it('fixture: early arrival (negative delay) is not actionable', () => {
      const itin = buildItinerary(false);
      const delayInfo = {
        changed: true,
        structural: false,
        delayMinutes: -30,
      };

      const result = classifyDisruption(itin, delayInfo, '2026-11-01T13:30:00');
      assert.deepStrictEqual(result, {
        actionable: false,
        reason: 'delay under 15 minutes',
        dayNumber: 1,
        option: null,
        capped: false,
      });
    });

    it('fixture: structural change is not actionable and requires manual review', () => {
      const itin = buildItinerary(false);
      const delayInfo = {
        changed: true,
        structural: true,
        delayMinutes: null,
      };

      const result = classifyDisruption(itin, delayInfo, '2026-11-01T15:00:00');
      assert.deepStrictEqual(result, {
        actionable: false,
        reason: 'route changed; needs manual review',
        dayNumber: null,
        option: null,
        capped: false,
      });
    });

    it('fixture: arrival date outside the trip dates is not actionable', () => {
      const itin = buildItinerary(false);
      const delayInfo = {
        changed: true,
        structural: false,
        delayMinutes: 60,
      };

      const result = classifyDisruption(itin, delayInfo, '2026-11-05T15:00:00'); // Outside Nov 1 - Nov 3
      assert.deepStrictEqual(result, {
        actionable: false,
        reason: 'arrival outside trip dates',
        dayNumber: null,
        option: 60,
        capped: false,
      });
    });

    it('fixture: day where every activity is done is not actionable', () => {
      const itin = buildItinerary(true); // All day 1 activities marked done
      const delayInfo = {
        changed: true,
        structural: false,
        delayMinutes: 60,
      };

      const result = classifyDisruption(itin, delayInfo, '2026-11-01T15:00:00');
      assert.deepStrictEqual(result, {
        actionable: false,
        reason: 'nothing left to reschedule',
        dayNumber: 1,
        option: 60,
        capped: false,
      });
    });

    it('fixture: delay capped when over 180 minutes', () => {
      const itin = buildItinerary(false);
      const delayInfo = {
        changed: true,
        structural: false,
        delayMinutes: 210, // 210 min > 180 min
      };

      const result = classifyDisruption(itin, delayInfo, '2026-11-01T17:30:00');
      assert.deepStrictEqual(result, {
        actionable: true,
        reason: null,
        dayNumber: 1,
        option: 180,
        capped: true,
      });
    });
  });

  describe('accountDeletion integration for Disruption', () => {
    it('includes Disruption in countUserData and deleteUserAndData', async () => {
      const testUserId = new mongoose.Types.ObjectId();

      const Itinerary = (await import('../src/models/Itinerary.js')).default;
      const Conversation = (await import('../src/models/Conversation.js')).default;
      const Expense = (await import('../src/models/Expense.js')).default;
      const Booking = (await import('../src/models/Booking.js')).default;
      const PackingTemplate = (await import('../src/models/PackingTemplate.js')).default;
      const User = (await import('../src/models/User.js')).default;

      const models = [Itinerary, Conversation, Expense, Booking, PackingTemplate, Disruption, User];
      const origMethods = models.map((m) => ({
        model: m,
        count: m.countDocuments,
        deleteMany: m.deleteMany,
        deleteOne: m.deleteOne,
      }));

      let disruptionCountFilter = null;
      let disruptionDeleteFilter = null;

      for (const m of models) {
        m.countDocuments = async (filter) => {
          if (m === Disruption) disruptionCountFilter = filter;
          return m === Disruption ? 3 : 1;
        };
        m.deleteMany = async (filter) => {
          if (m === Disruption) disruptionDeleteFilter = filter;
          return { deletedCount: m === Disruption ? 3 : 1 };
        };
        m.deleteOne = async () => ({ deletedCount: 1 });
      }

      try {
        const counts = await countUserData(testUserId);
        assert.strictEqual(counts.disruptions, 3);
        assert.deepStrictEqual(disruptionCountFilter, { userId: testUserId });

        const deleted = await deleteUserAndData(testUserId);
        assert.strictEqual(deleted.disruptions, 3);
        assert.deepStrictEqual(disruptionDeleteFilter, { userId: testUserId });
      } finally {
        for (const { model, count, deleteMany, deleteOne } of origMethods) {
          model.countDocuments = count;
          model.deleteMany = deleteMany;
          model.deleteOne = deleteOne;
        }
      }
    });
  });
});

