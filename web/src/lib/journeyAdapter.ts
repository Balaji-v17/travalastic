import type { Journey, TripCoverImage } from '../data/mockData.ts';
import type { BackendDayPlan } from './itineraryApi.ts';
import { backendDaysToItineraryDays } from './itineraryAdapter.ts';
import { tripHasBooking, tripStatus, type TripStatus, normalizeDateString, getLocalDateString } from './tripStatus.ts';

export const NEUTRAL_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e293b"/><stop offset="100%" stop-color="%230f172a"/></linearGradient></defs><rect width="800" height="500" fill="url(%23g)"/><circle cx="400" cy="250" r="160" fill="%23334155" opacity="0.2"/></svg>';

export function hasRealCoverImage(journey: { coverImage?: TripCoverImage | null; imageUrl?: string }): boolean {
  if (journey?.coverImage?.url && typeof journey.coverImage.url === 'string' && journey.coverImage.url.trim()) {
    return true;
  }
  const url = typeof journey?.imageUrl === 'string' ? journey.imageUrl.trim() : '';
  return Boolean(url && url !== NEUTRAL_PLACEHOLDER_IMAGE && !url.startsWith('data:image/svg+xml'));
}

export interface BackendSavedItinerary {
  _id?: string;
  id?: string;
  itineraryId?: string;
  userId?: string;
  destination?: string;
  destinationId?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  budgetTier?: 'budget' | 'mid' | 'luxury';
  budgetEstimate?: number;
  totalBudget?: number;
  currency?: string;
  travelers?: Array<{ name?: string }> | number;
  days?: BackendDayPlan[];
  itinerary?: BackendDayPlan[];
  coverImage?: TripCoverImage | null;
  imageUrl?: string;
  image?: string;
  destinationImage?: string;
  bookingsCount?: number;
  recordedBookingsCount?: number;
}

export interface BackendBooking {
  _id: string;
  id?: string;
  itineraryId?: string | null;
  type?: string;
  status?: string;
  airline?: string;
  origin?: string;
  destination?: string;
  totalAmount?: string | number;
  [key: string]: any;
}

function toDateString(d: string | Date | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
}


/**
 * Pure function deriving journey status using tripStatus:
 * - planning: no confirmed booking AND end date >= today.
 * - upcoming: at least one confirmed booking AND start date > today.
 * - in-progress: at least one confirmed booking AND start <= today <= end.
 * - completed: at least one confirmed booking AND end date < today.
 * - past: no confirmed booking AND end date < today.
 */
export function deriveStatus(
  startDate?: string | Date | null,
  endDate?: string | Date | null,
  today: string | Date = getLocalDateString(),
  hasBooking: boolean = false
): TripStatus {
  return tripStatus(
    {
      startDate: normalizeDateString(startDate),
      endDate: normalizeDateString(endDate),
      hasBooking,
    },
    today
  );
}

/**
 * Pure adapter converting a saved backend itinerary into the Journey shape used throughout the web app.
 * Only real fields are copied; no values are fabricated.
 */
export function toJourney(
  savedItinerary: BackendSavedItinerary,
  matchingBookings: (string | BackendBooking)[] = [],
  signedInUserId: string = '',
  matchingRecordedBookings: Array<{ status?: string }> = []
): Journey {
  const id = String(savedItinerary._id || savedItinerary.id || savedItinerary.itineraryId || '');
  const travelerId = signedInUserId || String(savedItinerary.userId || '');
  const destination = savedItinerary.destination ? String(savedItinerary.destination).trim() : '';
  const destinationId = (savedItinerary.destinationId || destination || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const title = savedItinerary.title ? String(savedItinerary.title).trim() : '';
  const startDate = savedItinerary.startDate ? String(savedItinerary.startDate).trim() : '';
  const endDate = savedItinerary.endDate ? String(savedItinerary.endDate).trim() : '';

  let travelersCount = 1;
  if (Array.isArray(savedItinerary.travelers) && savedItinerary.travelers.length > 0) {
    travelersCount = savedItinerary.travelers.length;
  } else if (typeof savedItinerary.travelers === 'number' && savedItinerary.travelers > 0) {
    travelersCount = savedItinerary.travelers;
  }

  const normalizedBookings: BackendBooking[] = matchingBookings.map((b) =>
    typeof b === 'string' ? { _id: b, id: b } : b
  );
  const bookingIds: string[] = normalizedBookings
    .map((b) => String(b._id || b.id || ''))
    .filter(Boolean);

  const hasBooking = tripHasBooking({
    bookings: normalizedBookings,
    recordedBookings: matchingRecordedBookings,
    bookingsCount: savedItinerary.bookingsCount,
    recordedBookingsCount: savedItinerary.recordedBookingsCount,
  });

  const status = tripStatus({
    startDate,
    endDate,
    hasBooking,
  });

  const rawDays = savedItinerary.days || savedItinerary.itinerary || [];
  const itinerary = backendDaysToItineraryDays(rawDays, startDate, destination, normalizedBookings);

  const realBudget =
    typeof savedItinerary.budgetEstimate === 'number' && savedItinerary.budgetEstimate > 0
      ? savedItinerary.budgetEstimate
      : typeof savedItinerary.totalBudget === 'number' && savedItinerary.totalBudget > 0
      ? savedItinerary.totalBudget
      : undefined;

  const rawCover = savedItinerary.coverImage;
  const coverUrl =
    rawCover && typeof rawCover.url === 'string' && rawCover.url.trim()
      ? rawCover.url.trim()
      : '';
  const coverImage: TripCoverImage | null = coverUrl
    ? {
        url: coverUrl,
        thumbUrl: rawCover?.thumbUrl ? String(rawCover.thumbUrl).trim() : coverUrl,
        photographer: rawCover?.photographer ? String(rawCover.photographer).trim() : null,
        photographerUrl: rawCover?.photographerUrl ? String(rawCover.photographerUrl).trim() : null,
        sourceUrl: rawCover?.sourceUrl ? String(rawCover.sourceUrl).trim() : null,
        source: rawCover?.source || 'pexels',
        fetchedAt: rawCover?.fetchedAt ? String(rawCover.fetchedAt) : null,
      }
    : null;

  const rawImage =
    coverUrl || savedItinerary.imageUrl || savedItinerary.image || savedItinerary.destinationImage;
  const imageUrl =
    rawImage && typeof rawImage === 'string' && rawImage.trim()
      ? rawImage.trim()
      : NEUTRAL_PLACEHOLDER_IMAGE;

  return {
    id,
    travelerId,
    destination,
    destinationId,
    title,
    status,
    startDate,
    endDate,
    travelers: travelersCount,
    bookings: bookingIds,
    totalBudget: realBudget,
    totalSpend: 0,
    currency: savedItinerary.currency || 'INR',
    imageUrl,
    coverImage,
    itinerary,
    notifications: [],
    disruptions: [],
  };
}

