import type { HotelFormValues } from './hotelForm.ts';

export interface HotelModel {
  _id: string;
  id: string;
  name: string;
  destination: string;
  city?: string;
  budgetTier: string;
  priceRangeINR: string | null;
  rating: number | null;
  priceReviewedAt: string | null;
  hidden: boolean;
  hiddenReason: string | null;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
  updatedByEmail?: string | null;
}

export type HotelPatchPayload = Partial<{
  name: string;
  destination: string;
  budgetTier: string;
  priceRangeINR: string | null;
  rating: number | null;
}>;

/**
 * Computes payload for creating or patching a hotel.
 * In create mode (original is null): returns the full sanitized payload.
 * In edit mode (original is provided): returns ONLY fields that have changed.
 * When an optional field is cleared, it sends null so the server unsets it.
 */
export function diffHotel(
  original: HotelModel | null,
  edited: HotelFormValues
): HotelPatchPayload {
  // Create mode: return complete payload
  if (!original) {
    const payload: HotelPatchPayload = {
      name: edited.name.trim().replace(/\s+/g, ' '),
      destination: edited.destination.trim().replace(/\s+/g, ' '),
      budgetTier: edited.budgetTier.trim().toLowerCase(),
    };

    if (edited.priceRangeINR && edited.priceRangeINR.trim()) {
      payload.priceRangeINR = edited.priceRangeINR.trim();
    }
    if (edited.rating !== undefined && edited.rating !== null && edited.rating.trim() !== '') {
      payload.rating = Number(edited.rating.trim());
    }

    return payload;
  }

  // Edit mode: compute changed fields
  const diff: HotelPatchPayload = {};

  // Name
  const cleanName = edited.name.trim().replace(/\s+/g, ' ');
  if (cleanName !== original.name) {
    diff.name = cleanName;
  }

  // Destination
  const cleanDest = edited.destination.trim().replace(/\s+/g, ' ');
  if (cleanDest !== original.destination) {
    diff.destination = cleanDest;
  }

  // Budget Tier
  const cleanTier = edited.budgetTier.trim().toLowerCase();
  if (cleanTier !== (original.budgetTier || '').toLowerCase()) {
    diff.budgetTier = cleanTier;
  }

  // Price range INR
  const cleanPrice = edited.priceRangeINR ? edited.priceRangeINR.trim() : '';
  const origPrice = original.priceRangeINR ? original.priceRangeINR.trim() : '';
  if (cleanPrice !== origPrice) {
    diff.priceRangeINR = cleanPrice ? cleanPrice : null;
  }

  // Rating
  const cleanRatingStr = edited.rating !== undefined && edited.rating !== null ? edited.rating.trim() : '';
  const cleanRatingNum = cleanRatingStr !== '' ? Number(cleanRatingStr) : null;
  const origRatingNum = original.rating !== undefined && original.rating !== null ? Number(original.rating) : null;
  if (cleanRatingNum !== origRatingNum) {
    diff.rating = cleanRatingNum;
  }

  return diff;
}

