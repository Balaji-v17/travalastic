import { apiFetch, ApiError } from './api.ts';
import type { CuratedHotelItem } from '../components/hotels/CuratedHotelCard';

export type { CuratedHotelItem };

export interface HotelsSearchQuery {
  destination: string;
  budgetTier?: string;
  checkinDate?: string;
  checkoutDate?: string;
  signal?: AbortSignal;
}

export interface HotelsSearchResponse {
  curatedHotels?: CuratedHotelItem[];
  hotels?: CuratedHotelItem[];
  bookingComSearchUrl?: string;
  error?: string;
}

export class HotelsApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'HotelsApiError';
    this.status = status;
    Object.setPrototypeOf(this, HotelsApiError.prototype);
  }
}

/**
 * Searches curated hotels for a given destination and generates an outbound Booking.com link.
 * Backend route: GET /hotels/search?destination=...&budgetTier=...&checkinDate=...&checkoutDate=...
 */
export async function listCuratedHotels(
  query: HotelsSearchQuery
): Promise<{ hotels: CuratedHotelItem[]; bookingComSearchUrl: string }> {
  const cleanDest = query.destination ? query.destination.trim() : '';
  if (!cleanDest) {
    throw new HotelsApiError('Destination is required to search hotels.', 400);
  }

  const searchParams = new URLSearchParams();
  searchParams.set('destination', cleanDest);

  if (query.budgetTier && query.budgetTier.trim()) {
    searchParams.set('budgetTier', query.budgetTier.trim());
  }
  if (query.checkinDate && query.checkinDate.trim()) {
    searchParams.set('checkinDate', query.checkinDate.trim());
  }
  if (query.checkoutDate && query.checkoutDate.trim()) {
    searchParams.set('checkoutDate', query.checkoutDate.trim());
  }

  try {
    const res = await apiFetch<HotelsSearchResponse>(
      `/hotels/search?${searchParams.toString()}`,
      {
        method: 'GET',
        signal: query.signal,
      }
    );

    const list = res.curatedHotels || res.hotels || [];
    return {
      hotels: Array.isArray(list) ? list : [],
      bookingComSearchUrl: res.bookingComSearchUrl || '',
    };
  } catch (err: any) {
    if (query.signal?.aborted) {
      throw err;
    }
    if (err instanceof ApiError) {
      throw new HotelsApiError(
        err.message || 'Failed to search curated hotels',
        err.status
      );
    }
    throw new HotelsApiError(
      err?.message || 'Unable to connect to hotels service. Please check your network connection.'
    );
  }
}

