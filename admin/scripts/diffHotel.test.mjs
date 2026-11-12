import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diffHotel } from '../src/lib/diffHotel.ts';

describe('diffHotel helper', () => {
  const originalHotel = {
    _id: '64f8a1234567890123456789',
    id: '64f8a1234567890123456789',
    name: 'Taj Fort Aguada',
    destination: 'Goa',
    budgetTier: 'luxury',
    priceRangeINR: '₹14,000 - ₹24,000',
    rating: 4.6,
    priceReviewedAt: '2026-02-01T10:00:00.000Z',
    hidden: false,
    hiddenReason: null,
  };

  it('returns empty object {} when no fields have changed', () => {
    const diff = diffHotel(originalHotel, {
      name: 'Taj Fort Aguada',
      destination: 'Goa',
      budgetTier: 'luxury',
      priceRangeINR: '₹14,000 - ₹24,000',
      rating: '4.6',
    });
    assert.deepEqual(diff, {});
  });

  it('detects single text field modifications', () => {
    const diff = diffHotel(originalHotel, {
      name: 'Taj Fort Aguada Resort & Spa',
      destination: 'Goa',
      budgetTier: 'luxury',
      priceRangeINR: '₹14,000 - ₹24,000',
      rating: '4.6',
    });
    assert.deepEqual(diff, {
      name: 'Taj Fort Aguada Resort & Spa',
    });
  });

  it('sends null when clearing optional fields', () => {
    const diff = diffHotel(originalHotel, {
      name: 'Taj Fort Aguada',
      destination: 'Goa',
      budgetTier: 'luxury',
      priceRangeINR: '',
      rating: '',
    });
    assert.deepEqual(diff, {
      priceRangeINR: null,
      rating: null,
    });
  });

  it('returns full payload in create mode (original is null)', () => {
    const full = diffHotel(null, {
      name: 'Seaside Hotel',
      destination: 'Kovalam',
      budgetTier: 'mid',
      priceRangeINR: '₹3,000 - ₹5,000',
      rating: '4.2',
    });
    assert.deepEqual(full, {
      name: 'Seaside Hotel',
      destination: 'Kovalam',
      budgetTier: 'mid',
      priceRangeINR: '₹3,000 - ₹5,000',
      rating: 4.2,
    });
  });
});

