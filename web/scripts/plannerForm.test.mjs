import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLocalDate,
  makeDefaultDna,
  validateDna,
} from '../src/lib/plannerForm.ts';

describe('Planner Form Pure Helpers', () => {
  describe('makeDefaultDna - Date Calculation and Defaults', () => {
    it('defaults on 2026-11-01 produce startDate 2026-12-01', () => {
      const today = new Date(2026, 10, 1); // 1 Nov 2026
      const dna = makeDefaultDna(today);

      assert.equal(dna.startDate, '2026-12-01');
      assert.equal(dna.destination, '');
      assert.equal(dna.destinationId, '');
      assert.equal(dna.origin, '');
      assert.equal(dna.nights, 3);
      assert.equal(dna.travelers, 1);
      assert.equal(dna.budget, '');
      assert.equal(dna.pace, 'balanced');
      assert.equal(dna.comfort, 'comfortable');
      assert.deepEqual(dna.interests, []);
      assert.equal(dna.mustHave, '');
      assert.equal(dna.avoid, '');
      assert.equal(dna.notes, '');
    });

    it('month and year rollover: today 2026-12-15 produces 2027-01-14', () => {
      const today = new Date(2026, 11, 15); // 15 Dec 2026
      const dna = makeDefaultDna(today);
      assert.equal(dna.startDate, '2027-01-14');
    });

    it('handles today = Jan 31 + 30 days without off-by-one errors (2026-01-31 -> 2026-03-02)', () => {
      const today = new Date(2026, 0, 31); // 31 Jan 2026 (non-leap year, 28 days in Feb)
      const dna = makeDefaultDna(today);
      assert.equal(dna.startDate, '2026-03-02');
    });

    it('preserves prefilled destination and destinationId without hardcoded fallback', () => {
      const today = new Date(2026, 10, 1);
      const dna = makeDefaultDna(today, {
        destination: 'Bali, Indonesia',
        destinationId: 'bali',
      });

      assert.equal(dna.destination, 'Bali, Indonesia');
      assert.equal(dna.destinationId, 'bali');
    });

    it('never falls back to "tokyo" when prefill is missing or empty', () => {
      const today = new Date(2026, 10, 1);
      const dna1 = makeDefaultDna(today);
      const dna2 = makeDefaultDna(today, {});
      const dna3 = makeDefaultDna(today, { destination: 'Paris' });

      assert.equal(dna1.destinationId, '');
      assert.equal(dna2.destinationId, '');
      assert.equal(dna3.destinationId, '');
      assert.notEqual(dna1.destinationId, 'tokyo');
      assert.notEqual(dna2.destinationId, 'tokyo');
      assert.notEqual(dna3.destinationId, 'tokyo');
    });
  });

  describe('validateDna - Destination validation', () => {
    const today = new Date(2026, 10, 1);
    const validDna = () => makeDefaultDna(today, { destination: 'Kyoto, Japan' });

    it('rejects empty or whitespace-only destination', () => {
      const res1 = validateDna({ ...validDna(), destination: '' }, today);
      assert.equal(res1.ok, false);
      assert.ok(res1.errors.destination);

      const res2 = validateDna({ ...validDna(), destination: '   ' }, today);
      assert.equal(res2.ok, false);
      assert.ok(res2.errors.destination);
    });

    it('rejects short destination (< 2 chars)', () => {
      const res = validateDna({ ...validDna(), destination: 'A' }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.destination);
    });

    it('rejects long destination (> 80 chars)', () => {
      const longDest = 'A'.repeat(81);
      const res = validateDna({ ...validDna(), destination: longDest }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.destination);
    });

    it('accepts valid destination (2 to 80 chars)', () => {
      const res2 = validateDna({ ...validDna(), destination: 'Goa' }, today);
      assert.equal(res2.errors.destination, undefined);

      const res80 = validateDna({ ...validDna(), destination: 'A'.repeat(80) }, today);
      assert.equal(res80.errors.destination, undefined);
    });
  });

  describe('validateDna - Start Date validation', () => {
    const today = new Date(2026, 10, 1); // 2026-11-01
    const validDna = () => makeDefaultDna(today, { destination: 'Paris, France' });

    it('rejects past date', () => {
      const res = validateDna({ ...validDna(), startDate: '2026-10-31' }, today);
      assert.equal(res.ok, false);
      assert.equal(res.errors.startDate, "Pick a start date that isn't in the past");
    });

    it('accepts today as start date', () => {
      const res = validateDna({ ...validDna(), startDate: '2026-11-01' }, today);
      assert.equal(res.errors.startDate, undefined);
    });

    it('accepts future date', () => {
      const res = validateDna({ ...validDna(), startDate: '2026-12-01' }, today);
      assert.equal(res.errors.startDate, undefined);
    });

    it('rejects empty or invalid date format', () => {
      const res1 = validateDna({ ...validDna(), startDate: '' }, today);
      assert.equal(res1.ok, false);
      assert.ok(res1.errors.startDate);

      const res2 = validateDna({ ...validDna(), startDate: 'not-a-date' }, today);
      assert.equal(res2.ok, false);
      assert.ok(res2.errors.startDate);
    });
  });

  describe('validateDna - Nights validation (1-14)', () => {
    const today = new Date(2026, 10, 1);
    const validDna = () => makeDefaultDna(today, { destination: 'London, UK' });

    it('rejects nights 0', () => {
      const res = validateDna({ ...validDna(), nights: 0 }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.nights);
    });

    it('rejects nights 15', () => {
      const res = validateDna({ ...validDna(), nights: 15 }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.nights);
    });

    it('rejects non-integer nights', () => {
      const res = validateDna({ ...validDna(), nights: 3.5 }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.nights);
    });

    it('accepts boundary nights 1 and 14', () => {
      const res1 = validateDna({ ...validDna(), nights: 1 }, today);
      assert.equal(res1.errors.nights, undefined);

      const res14 = validateDna({ ...validDna(), nights: 14 }, today);
      assert.equal(res14.errors.nights, undefined);
    });
  });

  describe('validateDna - Travelers validation (1-9)', () => {
    const today = new Date(2026, 10, 1);
    const validDna = () => makeDefaultDna(today, { destination: 'Rome, Italy' });

    it('rejects travelers 0', () => {
      const res = validateDna({ ...validDna(), travelers: 0 }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.travelers);
    });

    it('rejects travelers 10', () => {
      const res = validateDna({ ...validDna(), travelers: 10 }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.travelers);
    });

    it('rejects non-integer travelers', () => {
      const res = validateDna({ ...validDna(), travelers: 2.5 }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.travelers);
    });

    it('accepts boundary travelers 1 and 9', () => {
      const res1 = validateDna({ ...validDna(), travelers: 1 }, today);
      assert.equal(res1.errors.travelers, undefined);

      const res9 = validateDna({ ...validDna(), travelers: 9 }, today);
      assert.equal(res9.errors.travelers, undefined);
    });
  });

  describe('validateDna - Budget validation', () => {
    const today = new Date(2026, 10, 1);
    const validDna = () => makeDefaultDna(today, { destination: 'Madrid, Spain' });

    it('accepts empty budget ("")', () => {
      const res = validateDna({ ...validDna(), budget: '' }, today);
      assert.equal(res.errors.budget, undefined);
    });

    it('accepts null or undefined budget', () => {
      const res1 = validateDna({ ...validDna(), budget: null }, today);
      assert.equal(res1.errors.budget, undefined);

      const res2 = validateDna({ ...validDna(), budget: undefined }, today);
      assert.equal(res2.errors.budget, undefined);
    });

    it('rejects negative budget', () => {
      const res = validateDna({ ...validDna(), budget: -500 }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.budget);
    });

    it('rejects zero budget', () => {
      const res = validateDna({ ...validDna(), budget: 0 }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.budget);
    });

    it('rejects non-integer budget', () => {
      const res = validateDna({ ...validDna(), budget: 15000.5 }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.budget);
    });

    it('rejects non-numeric string budget', () => {
      const res = validateDna({ ...validDna(), budget: 'abc' }, today);
      assert.equal(res.ok, false);
      assert.ok(res.errors.budget);
    });

    it('accepts positive integer budget', () => {
      const res = validateDna({ ...validDna(), budget: 250000 }, today);
      assert.equal(res.errors.budget, undefined);
    });
  });

  describe('validateDna - Overall valid state', () => {
    const today = new Date(2026, 10, 1);

    it('passes for a fully valid DNA state', () => {
      const dna = makeDefaultDna(today, { destination: 'Amsterdam, Netherlands' });
      const res = validateDna(dna, today);
      assert.equal(res.ok, true);
      assert.deepEqual(res.errors, {});
    });
  });
});
