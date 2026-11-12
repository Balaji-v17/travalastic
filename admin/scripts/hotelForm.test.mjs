import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateHotelForm } from '../src/lib/hotelForm.ts';

describe('hotelForm helper', () => {
  const validValues = {
    name: 'Alila Diwa Goa',
    destination: 'Goa',
    budgetTier: 'luxury',
    priceRangeINR: '₹14,000 - ₹24,000',
    rating: '4.6',
  };

  it('passes validation with all valid inputs', () => {
    const res = validateHotelForm(validValues);
    assert.equal(res.isValid, true);
    assert.deepEqual(res.errors, {});
  });

  describe('name validation', () => {
    it('rejects empty or whitespace-only name', () => {
      const res = validateHotelForm({ ...validValues, name: '   ' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.name, /name is required/i);
    });

    it('rejects name shorter than 2 characters', () => {
      const res = validateHotelForm({ ...validValues, name: 'A' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.name, /at least 2 characters/i);
    });

    it('rejects name longer than 120 characters', () => {
      const longName = 'A'.repeat(121);
      const res = validateHotelForm({ ...validValues, name: longName });
      assert.equal(res.isValid, false);
      assert.match(res.errors.name, /cannot exceed 120 characters/i);
    });

    it('rejects HTML tags in name', () => {
      const res = validateHotelForm({ ...validValues, name: '<b>Grand Hotel</b>' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.name, /HTML tags are not allowed/i);
    });
  });

  describe('destination validation', () => {
    it('rejects missing or empty destination', () => {
      const res = validateHotelForm({ ...validValues, destination: '' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.destination, /destination is required/i);
    });

    it('rejects HTML tags in destination', () => {
      const res = validateHotelForm({ ...validValues, destination: '<script>Goa</script>' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.destination, /HTML tags are not allowed/i);
    });
  });

  describe('budgetTier validation', () => {
    it('rejects missing or invalid budgetTier', () => {
      const res1 = validateHotelForm({ ...validValues, budgetTier: '' });
      assert.equal(res1.isValid, false);
      assert.match(res1.errors.budgetTier, /budget tier is required/i);

      const res2 = validateHotelForm({ ...validValues, budgetTier: 'resort' });
      assert.equal(res2.isValid, false);
      assert.match(res2.errors.budgetTier, /must be one of: budget, mid, luxury/i);
    });

    it('accepts valid budget tiers (budget, mid, luxury)', () => {
      assert.equal(validateHotelForm({ ...validValues, budgetTier: 'budget' }).isValid, true);
      assert.equal(validateHotelForm({ ...validValues, budgetTier: 'mid' }).isValid, true);
      assert.equal(validateHotelForm({ ...validValues, budgetTier: 'luxury' }).isValid, true);
    });
  });

  describe('priceRangeINR validation', () => {
    it('allows empty or optional priceRangeINR', () => {
      const res = validateHotelForm({ ...validValues, priceRangeINR: '' });
      assert.equal(res.isValid, true);
      assert.equal(res.errors.priceRangeINR, undefined);
    });

    it('rejects price <= 0', () => {
      const res0 = validateHotelForm({ ...validValues, priceRangeINR: '0' });
      assert.equal(res0.isValid, false);
      assert.match(res0.errors.priceRangeINR, /greater than 0/i);

      const resNeg = validateHotelForm({ ...validValues, priceRangeINR: '-500' });
      assert.equal(resNeg.isValid, false);
      assert.match(resNeg.errors.priceRangeINR, /greater than 0/i);
    });

    it('rejects price exceeding 1,000,000 INR', () => {
      const res = validateHotelForm({ ...validValues, priceRangeINR: '₹15,00,000' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.priceRangeINR, /cannot exceed/i);
    });

    it('rejects inverted range (min > max)', () => {
      const res = validateHotelForm({ ...validValues, priceRangeINR: '₹20,000 - ₹10,000' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.priceRangeINR, /minimum price cannot exceed maximum price/i);
    });

    it('rejects HTML tags in priceRangeINR', () => {
      const res = validateHotelForm({ ...validValues, priceRangeINR: '<b>5000</b>' });
      assert.equal(res.isValid, false);
      assert.match(res.errors.priceRangeINR, /HTML tags/i);
    });
  });

  describe('rating validation', () => {
    it('allows empty rating', () => {
      const res = validateHotelForm({ ...validValues, rating: '' });
      assert.equal(res.isValid, true);
    });

    it('rejects rating > 5 or < 0 or non-numeric', () => {
      const resHigh = validateHotelForm({ ...validValues, rating: '5.1' });
      assert.equal(resHigh.isValid, false);
      assert.match(resHigh.errors.rating, /between 0 and 5/i);

      const resNeg = validateHotelForm({ ...validValues, rating: '-0.5' });
      assert.equal(resNeg.isValid, false);

      const resText = validateHotelForm({ ...validValues, rating: 'five' });
      assert.equal(resText.isValid, false);
    });
  });
});

