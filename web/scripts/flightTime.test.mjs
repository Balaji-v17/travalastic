import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { formatLocalTime, formatDateLabel } from '../src/lib/flightAdapter.ts';

describe('Airport-Local Flight Time & Date Formatting (Web)', () => {
  it('formatLocalTime and formatDateLabel extract values strictly from string parts', () => {
    assert.equal(formatLocalTime('2026-12-01T08:30:00'), '08:30');
    assert.equal(formatLocalTime('2026-12-01T15:45:00'), '15:45');
    assert.equal(formatDateLabel('2026-12-01T08:30:00'), '1 Dec');
    assert.equal(formatDateLabel('2026-05-14T10:00:00'), '14 May');
  });

  describe('Cross-timezone Invariance: TZ=America/Los_Angeles vs TZ=Asia/Kolkata', () => {
    const runInTimezone = (tz, isoStr) => {
      const script = `
        import { formatLocalTime, formatDateLabel } from './src/lib/flightAdapter.ts';
        const iso = process.argv[1];
        const res = {
          time: formatLocalTime(iso),
          date: formatDateLabel(iso),
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
        '2026-12-01T08:30:00Z',
      ];

      for (const iso of testCases) {
        const laResult = runInTimezone('America/Los_Angeles', iso);
        const kolkataResult = runInTimezone('Asia/Kolkata', iso);

        assert.deepEqual(
          laResult,
          kolkataResult,
          `Web output in America/Los_Angeles must match Asia/Kolkata for ${iso}`
        );
        if (iso.includes('08:30')) {
          assert.equal(laResult.time, '08:30');
          assert.equal(laResult.date, '1 Dec');
        }
        if (iso.includes('15:45')) {
          assert.equal(laResult.time, '15:45');
        }
      }
    });
  });
});
