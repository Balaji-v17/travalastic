import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDelay,
  viewStateFor,
  resolveActivityTitle,
  formatLocalTime,
  formatLocalDateTime,
  reminderLines,
} from '../src/lib/disruptionView.ts';

describe('Disruption View Pure Helpers', () => {
  describe('formatDelay', () => {
    it('formats 1 minute', () => {
      assert.equal(formatDelay(1), '1 min');
    });

    it('formats 59 minutes', () => {
      assert.equal(formatDelay(59), '59 min');
    });

    it('formats 60 minutes as 1 h', () => {
      assert.equal(formatDelay(60), '1 h');
    });

    it('formats 61 minutes as 1 h 1 min', () => {
      assert.equal(formatDelay(61), '1 h 1 min');
    });

    it('formats 125 minutes as 2 h 5 min', () => {
      assert.equal(formatDelay(125), '2 h 5 min');
    });

    it('formats 180 minutes as 3 h', () => {
      assert.equal(formatDelay(180), '3 h');
    });

    it('formats 200 minutes as 3 h 20 min', () => {
      assert.equal(formatDelay(200), '3 h 20 min');
    });

    it('handles 0, null, undefined and negative values', () => {
      assert.equal(formatDelay(0), '0 min');
      assert.equal(formatDelay(-5), '0 min');
      assert.equal(formatDelay(null), '0 min');
      assert.equal(formatDelay(undefined), '0 min');
    });
  });

  describe('viewStateFor', () => {
    it('handles null / undefined / empty input', () => {
      assert.equal(viewStateFor(null), 'generating');
      assert.equal(viewStateFor(undefined), 'generating');
      assert.equal(viewStateFor({}), 'generating');
    });

    it('maps status "new" with no proposal to "generating"', () => {
      assert.equal(viewStateFor({ status: 'new' }), 'generating');
      assert.equal(viewStateFor({ status: 'new', proposal: null }), 'generating');
    });

    it('maps status "proposed" with kind "reschedule" to "review"', () => {
      assert.equal(
        viewStateFor({ status: 'proposed', proposal: { kind: 'reschedule' } }),
        'review'
      );
    });

    it('maps status "proposed" with kind "manual_review" to "manual_review"', () => {
      assert.equal(
        viewStateFor({ status: 'proposed', proposal: { kind: 'manual_review' } }),
        'manual_review'
      );
    });

    it('maps status "proposed" with missing proposal kind to "review"', () => {
      assert.equal(viewStateFor({ status: 'proposed', proposal: null }), 'review');
    });

    it('maps status "approved" to "applied"', () => {
      assert.equal(
        viewStateFor({ status: 'approved', proposal: { kind: 'reschedule' } }),
        'applied'
      );
      assert.equal(
        viewStateFor({ status: 'approved', proposal: { kind: 'manual_review' } }),
        'applied'
      );
    });

    it('maps status "reverted" to "closed"', () => {
      assert.equal(viewStateFor({ status: 'reverted' }), 'closed');
    });

    it('maps status "dismissed" to "closed"', () => {
      assert.equal(viewStateFor({ status: 'dismissed' }), 'closed');
    });

    it('maps status "expired" to "closed"', () => {
      assert.equal(viewStateFor({ status: 'expired' }), 'closed');
    });
  });

  describe('resolveActivityTitle', () => {
    const mockDays = [
      {
        day: 1,
        activities: [
          { id: 'act-1', title: 'Sensoji Temple' },
          { id: 'act-2', name: 'Nakamise Street' },
        ],
      },
      {
        day: 2,
        activities: [
          { placeId: 'place-99', title: 'TeamLab Planets' },
          { _id: 'mongo-id-123', title: 'Shibuya Sky' },
        ],
      },
    ];

    it('resolves title by matching id, name, or placeId', () => {
      assert.equal(resolveActivityTitle('act-1', mockDays), 'Sensoji Temple');
      assert.equal(resolveActivityTitle('act-2', mockDays), 'Nakamise Street');
      assert.equal(resolveActivityTitle('place-99', mockDays), 'TeamLab Planets');
      assert.equal(resolveActivityTitle('mongo-id-123', mockDays), 'Shibuya Sky');
    });

    it('falls back to "An activity" when id cannot be found', () => {
      assert.equal(resolveActivityTitle('unknown-id', mockDays), 'An activity');
    });

    it('falls back to "An activity" on null/empty days without crashing', () => {
      assert.equal(resolveActivityTitle('act-1', null), 'An activity');
      assert.equal(resolveActivityTitle('act-1', []), 'An activity');
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


