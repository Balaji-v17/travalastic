import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import {
  formatAirportTime,
  formatAirportDateSnippet,
  formatAirportDate,
  formatAirportDateTime,
} from '../src/utils/flightTime.js';

describe('Airport-Local Flight Time & Date Formatting', () => {
  const sampleMorning = '2026-12-01T08:30:00';
  const sampleAfternoon = '2026-12-01T15:45:00';
  const sampleMidnight = '2026-12-01T00:15:00';

  describe('Pure function unit tests', () => {
    it('formatAirportTime formats 12h with AM/PM and 24h correctly', () => {
      assert.equal(formatAirportTime(sampleMorning), '08:30 AM');
      assert.equal(formatAirportTime(sampleMorning, { hour12: false }), '08:30');

      assert.equal(formatAirportTime(sampleAfternoon), '03:45 PM');
      assert.equal(formatAirportTime(sampleAfternoon, { hour12: false }), '15:45');

      assert.equal(formatAirportTime(sampleMidnight), '12:15 AM');
      assert.equal(formatAirportTime(sampleMidnight, { hour12: false }), '00:15');

      assert.equal(formatAirportTime(null), '--:--');
      assert.equal(formatAirportTime(''), '--:--');
    });

    it('formatAirportDateSnippet extracts month and day strictly from string parts', () => {
      assert.equal(formatAirportDateSnippet(sampleMorning), 'Dec 1');
      assert.equal(formatAirportDateSnippet('2026-05-14T10:00:00'), 'May 14');
      assert.equal(formatAirportDateSnippet(''), '');
      assert.equal(formatAirportDateSnippet(null), '');
    });

    it('formatAirportDate formats weekday, month, day, year', () => {
      assert.equal(formatAirportDate(sampleMorning), 'Tue, Dec 1, 2026');
      assert.equal(formatAirportDate('2026-05-14T10:00:00'), 'Thu, May 14, 2026');
      assert.equal(formatAirportDate(null), 'Date TBD');
    });

    it('formatAirportDateTime formats combined string', () => {
      assert.equal(formatAirportDateTime(sampleMorning), '08:30 AM (Dec 1)');
      assert.equal(formatAirportDateTime(null), 'Scheduled');
    });
  });

  describe('Cross-timezone Invariance: TZ=America/Los_Angeles vs TZ=Asia/Kolkata', () => {
    const runInTimezone = (tz, isoStr) => {
      const script = `
        import {
          formatAirportTime,
          formatAirportDateSnippet,
          formatAirportDate,
          formatAirportDateTime,
        } from './src/utils/flightTime.js';

        const iso = process.argv[1];
        const res = {
          time12: formatAirportTime(iso, { hour12: true }),
          time24: formatAirportTime(iso, { hour12: false }),
          snippet: formatAirportDateSnippet(iso),
          fullDate: formatAirportDate(iso),
          dateTime: formatAirportDateTime(iso),
        };
        console.log(JSON.stringify(res));
      `;

      const output = execFileSync(
        process.execPath,
        ['--input-type=module', '-e', script, isoStr],
        {
          env: { ...process.env, TZ: tz },
          encoding: 'utf8',
        }
      );
      return JSON.parse(output.trim());
    };

    it('shows exact same displayed time and date in America/Los_Angeles and Asia/Kolkata', () => {
      const testCases = [
        '2026-12-01T08:30:00',
        '2026-12-01T15:45:00',
        '2026-12-01T00:15:00',
        '2026-12-01T23:55:00',
        '2026-12-01T08:30:00Z', // Even with trailing Z
      ];

      for (const iso of testCases) {
        const laResult = runInTimezone('America/Los_Angeles', iso);
        const kolkataResult = runInTimezone('Asia/Kolkata', iso);

        assert.deepEqual(
          laResult,
          kolkataResult,
          `Output in America/Los_Angeles must match Asia/Kolkata for ${iso}`
        );

        // Explicit values check
        if (iso.startsWith('2026-12-01T08:30:00')) {
          assert.equal(laResult.time12, '08:30 AM');
          assert.equal(laResult.time24, '08:30');
          assert.equal(laResult.snippet, 'Dec 1');
          assert.equal(laResult.fullDate, 'Tue, Dec 1, 2026');
          assert.equal(laResult.dateTime, '08:30 AM (Dec 1)');
        }
      }
    });
  });
});

