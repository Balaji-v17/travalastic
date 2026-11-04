import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDelay,
  viewStateFor,
  resolveActivityTitle,
  formatLocalTime,
  formatLocalDateTime,
  reminderLines,
} from '../src/utils/disruptions.js';

describe('Disruptions Pure Helpers', () => {
  describe('formatDelay', () => {
    it('formats 1 minute', () => {
      assert.equal(formatDelay(1), '1 min');
    });

    it('formats 59 minutes', () => {
      assert.equal(formatDelay(59), '59 min');
    });

    it('formats 60 minutes exactly as 1 h', () => {
      assert.equal(formatDelay(60), '1 h');
    });

    it('formats 61 minutes as 1 h 1 min', () => {
      assert.equal(formatDelay(61), '1 h 1 min');
    });

    it('formats 125 minutes as 2 h 5 min', () => {
      assert.equal(formatDelay(125), '2 h 5 min');
    });

    it('formats 180 minutes exactly as 3 h', () => {
      assert.equal(formatDelay(180), '3 h');
    });

    it('formats 200 minutes as 3 h 20 min', () => {
      assert.equal(formatDelay(200), '3 h 20 min');
    });

    it('handles 0 and negative inputs safely', () => {
      assert.equal(formatDelay(0), '0 min');
      assert.equal(formatDelay(-10), '0 min');
      assert.equal(formatDelay(null), '0 min');
    });
  });

  describe('viewStateFor', () => {
    it('returns loading when disruption is null or undefined', () => {
      assert.equal(viewStateFor(null), 'loading');
      assert.equal(viewStateFor(undefined), 'loading');
    });

    it('maps status "new" to "new"', () => {
      assert.equal(viewStateFor({ status: 'new' }), 'new');
    });

    it('maps status "proposed" with kind "reschedule" to "proposed_reschedule"', () => {
      assert.equal(
        viewStateFor({
          status: 'proposed',
          proposal: { kind: 'reschedule' },
        }),
        'proposed_reschedule'
      );
    });

    it('maps status "proposed" with kind "manual_review" to "proposed_manual_review"', () => {
      assert.equal(
        viewStateFor({
          status: 'proposed',
          proposal: { kind: 'manual_review' },
        }),
        'proposed_manual_review'
      );
    });

    it('maps status "approved" to "approved"', () => {
      assert.equal(viewStateFor({ status: 'approved' }), 'approved');
    });

    it('maps status "reverted" to "reverted"', () => {
      assert.equal(viewStateFor({ status: 'reverted' }), 'reverted');
    });

    it('maps status "dismissed" to "dismissed"', () => {
      assert.equal(viewStateFor({ status: 'dismissed' }), 'dismissed');
    });

    it('maps status "expired" to "expired"', () => {
      assert.equal(viewStateFor({ status: 'expired' }), 'expired');
    });
  });

  describe('resolveActivityTitle', () => {
    const mockDays = [
      {
        dayNumber: 1,
        activities: [
          { id: 'act_101', title: 'Visit Sensoji Temple' },
          { _id: 'act_102', name: 'Asakusa Street Food Walk' },
        ],
      },
      {
        dayNumber: 2,
        activities: [
          { placeId: 'act_201', title: 'TeamLab Planets' },
          { activityId: 'act_202', name: 'Shibuya Crossing' },
          'Meiji Shrine Visit',
        ],
      },
    ];

    it('resolves title by matching id, _id, placeId, or activityId', () => {
      assert.equal(resolveActivityTitle('act_101', mockDays), 'Visit Sensoji Temple');
      assert.equal(resolveActivityTitle('act_102', mockDays), 'Asakusa Street Food Walk');
      assert.equal(resolveActivityTitle('act_201', mockDays), 'TeamLab Planets');
      assert.equal(resolveActivityTitle('act_202', mockDays), 'Shibuya Crossing');
    });

    it('falls back to "An activity" when activityId does not exist', () => {
      assert.equal(resolveActivityTitle('act_999', mockDays), 'An activity');
    });

    it('falls back to "An activity" when title is blank or missing', () => {
      const daysWithBlank = [
        {
          dayNumber: 1,
          activities: [{ id: 'blank_1', title: '   ' }],
        },
      ];
      assert.equal(resolveActivityTitle('blank_1', daysWithBlank), 'An activity');
    });

    it('falls back to "An activity" on invalid/empty days input without crashing', () => {
      assert.equal(resolveActivityTitle('act_101', null), 'An activity');
      assert.equal(resolveActivityTitle('act_101', []), 'An activity');
      assert.equal(resolveActivityTitle(null, mockDays), 'An activity');
    });
  });

  describe('formatLocalTime', () => {
    it('extracts "14:00" from standard 24h ISO string "2026-11-20T14:00:00"', () => {
      assert.equal(formatLocalTime('2026-11-20T14:00:00'), '14:00');
    });

    it('extracts "09:05" preserving leading zeros from "2026-11-20T09:05:00"', () => {
      assert.equal(formatLocalTime('2026-11-20T09:05:00'), '09:05');
    });

    it('handles ISO string with seconds and milliseconds', () => {
      assert.equal(formatLocalTime('2026-11-20T14:00:15.123'), '14:00');
    });

    it('preserves written clock digits without timezone shift for trailing "Z"', () => {
      // Documented behavior: extracts written clock digits without timezone conversion
      assert.equal(formatLocalTime('2026-11-20T14:00:00Z'), '14:00');
    });

    it('preserves written clock digits without timezone shift for explicit offset', () => {
      // Documented behavior: extracts written clock digits directly without converting by offset
      assert.equal(formatLocalTime('2026-11-20T14:00:00+05:30'), '14:00');
      assert.equal(formatLocalTime('2026-11-20T14:00:00-08:00'), '14:00');
    });

    it('returns null on null, undefined, empty, or garbage input without throwing', () => {
      assert.equal(formatLocalTime(null), null);
      assert.equal(formatLocalTime(undefined), null);
      assert.equal(formatLocalTime(''), null);
      assert.equal(formatLocalTime('   '), null);
      assert.equal(formatLocalTime('not-a-date'), null);
      assert.equal(formatLocalTime('2026-11-20T25:00:00'), null);
      assert.equal(formatLocalTime('2026-11-20T14:99:00'), null);
    });
  });

  describe('formatLocalDateTime', () => {
    it('formats ISO local datetime into "20 Nov, 16:05"', () => {
      assert.equal(formatLocalDateTime('2026-11-20T16:05:00'), '20 Nov, 16:05');
    });

    it('formats single-digit day into "5 Jan, 09:00"', () => {
      assert.equal(formatLocalDateTime('2026-01-05T09:00:00'), '5 Jan, 09:00');
    });

    it('returns null on null, undefined, empty, or garbage input without throwing', () => {
      assert.equal(formatLocalDateTime(null), null);
      assert.equal(formatLocalDateTime(undefined), null);
      assert.equal(formatLocalDateTime(''), null);
      assert.equal(formatLocalDateTime('invalid'), null);
      assert.equal(formatLocalDateTime('2026-13-01T10:00:00'), null);
    });
  });

  describe('reminderLines', () => {
    const FORBIDDEN_PATTERN = /rebooked|updated|notified/i;

    it('normal delay: both times present on same day shows "(was ...)"', () => {
      const details = {
        oldArrival: '2026-11-20T14:00:00',
        newArrival: '2026-11-20T16:05:00',
        delayMinutes: 125,
        structural: false,
      };
      const lines = reminderLines(details);
      assert.equal(lines.length, 2);
      assert.equal(
        lines[0],
        'Your flight now arrives at 16:05 (was 14:00), local time at the destination airport.'
      );
      assert.equal(
        lines[1],
        "If you've arranged a pickup, hotel check-in or any reservation for this flight, tell them about the new time. I can't change those for you."
      );
    });

    it('missing oldArrival: omits the "(was ...)" part', () => {
      const details = {
        oldArrival: null,
        newArrival: '2026-11-20T16:05:00',
        delayMinutes: 125,
        structural: false,
      };
      const lines = reminderLines(details);
      assert.equal(lines.length, 2);
      assert.equal(
        lines[0],
        'Your flight now arrives at 16:05, local time at the destination airport.'
      );
      assert.equal(
        lines[1],
        "If you've arranged a pickup, hotel check-in or any reservation for this flight, tell them about the new time. I can't change those for you."
      );
    });

    it('missing newArrival: shows "check the airline" with no time claim', () => {
      const details = {
        oldArrival: '2026-11-20T14:00:00',
        newArrival: null,
        delayMinutes: null,
        structural: false,
      };
      const lines = reminderLines(details);
      assert.equal(lines.length, 2);
      assert.equal(
        lines[0],
        'Your flight details changed. Check the airline for the new times.'
      );
      assert.equal(
        lines[1],
        "If you've arranged a pickup, hotel check-in or any reservation for this flight, tell them about the new time. I can't change those for you."
      );
    });

    it('structural true: shows "check the airline" with no time claim even if times present', () => {
      const details = {
        oldArrival: '2026-11-20T14:00:00',
        newArrival: '2026-11-20T16:05:00',
        delayMinutes: null,
        structural: true,
      };
      const lines = reminderLines(details);
      assert.equal(lines.length, 2);
      assert.equal(
        lines[0],
        'Your flight details changed. Check the airline for the new times.'
      );
      assert.equal(
        lines[1],
        "If you've arranged a pickup, hotel check-in or any reservation for this flight, tell them about the new time. I can't change those for you."
      );
    });

    it('midnight rollover: shows both times and "next day" marker derived from DATE parts', () => {
      const details = {
        oldArrival: '2026-11-20T23:30:00',
        newArrival: '2026-11-21T01:35:00',
        delayMinutes: 125,
        structural: false,
      };
      const lines = reminderLines(details);
      assert.equal(lines.length, 2);
      assert.equal(
        lines[0],
        'Your flight now arrives at 01:35 (next day, was 23:30), local time at the destination airport.'
      );
      assert.equal(
        lines[1],
        "If you've arranged a pickup, hotel check-in or any reservation for this flight, tell them about the new time. I can't change those for you."
      );
    });

    it('asserts that output lines across all scenarios never contain forbidden words', () => {
      const scenarios = [
        { oldArrival: '2026-11-20T14:00:00', newArrival: '2026-11-20T16:05:00', structural: false },
        { newArrival: '2026-11-20T16:05:00', structural: false },
        { oldArrival: '2026-11-20T14:00:00', structural: false },
        { structural: true, oldArrival: '2026-11-20T14:00:00', newArrival: '2026-11-20T16:05:00' },
        { oldArrival: '2026-11-20T23:30:00', newArrival: '2026-11-21T01:35:00', structural: false },
        null,
        undefined,
        {},
      ];

      for (const scen of scenarios) {
        const lines = reminderLines(scen);
        for (const line of lines) {
          assert.equal(
            FORBIDDEN_PATTERN.test(line),
            false,
            `Line "${line}" must not contain forbidden words (rebooked/updated/notified)`
          );
        }
      }
    });
  });
});


